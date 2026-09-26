/// Dart client for the live-mutex Broker1 protocol.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:uuid/uuid.dart';

const String protocolVersion = '0.2.25';
const int maxFencingToken = 9007199254740991;

class LiveMutexException implements Exception {
  final String message;
  LiveMutexException(this.message);
  @override
  String toString() => 'LiveMutexException: $message';
}

int _fence(dynamic value, [String field = 'fencingToken']) {
  int? token;
  if (value is int) {
    token = value;
  } else if (value is String && RegExp(r'^[1-9][0-9]*$').hasMatch(value)) {
    token = int.tryParse(value);
  }
  if (token == null || token < 1 || token > maxFencingToken) {
    throw LiveMutexException('$field must be an exact integer in 1..$maxFencingToken');
  }
  return token;
}

class LockGrant {
  final String key;
  final String lockUuid;
  final int fencingToken;
  final int? lockRequestCount;
  LockGrant({
    required this.key,
    required this.lockUuid,
    required this.fencingToken,
    this.lockRequestCount,
  });
}

class AcquireManyGrant {
  final List<String> keys;
  final String lockUuid;
  final Map<String, int> fencingTokens;
  AcquireManyGrant({
    required this.keys,
    required this.lockUuid,
    required this.fencingTokens,
  });
}

class Client {
  final Socket _socket;
  final Map<String, Completer<Map<String, dynamic>>> _inflight = {};
  final Duration requestTimeout;
  final Uuid _uuid = const Uuid();
  bool _closed = false;

  Client._(this._socket, this.requestTimeout);

  static Future<Client> connect({
    String host = '127.0.0.1',
    int port = 6970,
    Duration requestTimeout = const Duration(seconds: 60),
  }) async {
    final socket = await Socket.connect(host, port);
    socket.setOption(SocketOption.tcpNoDelay, true);
    final client = Client._(socket, requestTimeout);
    socket.cast<List<int>>()
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen(
          client._onLine,
          onError: (_) => client._closeWithError(),
          onDone: () => client._closeWithError(),
        );
    socket.write('${jsonEncode({'type': 'version', 'value': protocolVersion})}\n');
    return client;
  }

  void _onLine(String line) {
    if (line.isEmpty) {
      return;
    }
    final dynamic decoded;
    try {
      decoded = jsonDecode(line);
    } catch (_) {
      return;
    }
    if (decoded is! Map<String, dynamic>) {
      return;
    }
    final uuid = decoded['uuid'];
    if (uuid is! String) {
      return;
    }
    final completer = _inflight.remove(uuid);
    if (completer != null && !completer.isCompleted) {
      completer.complete(decoded);
    }
  }

  void _closeWithError() {
    if (_closed) {
      return;
    }
    _closed = true;
    for (final c in _inflight.values) {
      if (!c.isCompleted) {
        c.completeError(LiveMutexException('connection closed'));
      }
    }
    _inflight.clear();
  }

  Future<void> close() async {
    if (_closed) {
      return;
    }
    _closed = true;
    try {
      await _socket.flush();
    } catch (_) {
      // Best-effort shutdown.
    }
    try {
      await _socket.close();
    } catch (_) {
      // Best-effort shutdown.
    }
    _closeWithError();
  }

  Future<Map<String, dynamic>> _awaitReply(String requestUuid, Map<String, dynamic> payload) {
    final completer = Completer<Map<String, dynamic>>();
    _inflight[requestUuid] = completer;
    _socket.write('${jsonEncode(payload)}\n');
    return completer.future.timeout(requestTimeout, onTimeout: () {
      _inflight.remove(requestUuid);
      throw LiveMutexException('request timed out');
    });
  }

  Future<LockGrant> acquire(String key, {int? ttlMs, int? max}) async {
    final reqUuid = _uuid.v4();
    final payload = <String, dynamic>{
      'type': 'lock', 'uuid': reqUuid, 'key': key, 'ttl': ttlMs,
      'pid': pid, 'keepLocksAfterDeath': false,
    };
    if (max != null) {
      payload['max'] = max;
    }
    final reply = await _awaitReply(reqUuid, payload);
    if (reply['acquired'] != true) {
      throw LiveMutexException(reply['error']?.toString() ?? 'lock not acquired');
    }
    final fence = _fence(reply['fencingToken']);
    final rawCount = reply['lockRequestCount'];
    return LockGrant(
      key: key,
      lockUuid: reqUuid,
      fencingToken: fence,
      lockRequestCount: rawCount is int && rawCount >= 0 ? rawCount : null,
    );
  }

  Future<void> release(String key, String lockUuid, {bool force = false}) async {
    final reqUuid = _uuid.v4();
    final reply = await _awaitReply(reqUuid, {
      'type': 'unlock', 'uuid': reqUuid, '_uuid': lockUuid, 'key': key, 'force': force,
    });
    if (reply['unlocked'] != true) {
      throw LiveMutexException(reply['error']?.toString() ?? 'unlock rejected');
    }
  }

  Future<AcquireManyGrant> acquireMany(List<String> keys, {int? ttlMs}) async {
    if (keys.isEmpty) {
      throw ArgumentError('acquireMany requires at least one key');
    }
    final reqUuid = _uuid.v4();
    final reply = await _awaitReply(reqUuid, {
      'type': 'acquire-many', 'uuid': reqUuid, 'keys': keys, 'ttl': ttlMs,
    });
    if (reply['acquired'] != true) {
      final why = reply['error'] ?? (reply['contendedKey'] != null
          ? 'contended on ${reply['contendedKey']}' : 'acquire-many rejected');
      throw LiveMutexException(why.toString());
    }
    final returnedKeys = (reply['keys'] is List)
        ? (reply['keys'] as List).map((e) => e.toString()).toList()
        : List<String>.from(keys);
    final raw = reply['fencingTokens'];
    if (raw is! Map) {
      throw LiveMutexException('acquire-many omitted fencingTokens');
    }
    final tokens = <String, int>{};
    for (final key in returnedKeys) {
      if (!raw.containsKey(key)) {
        throw LiveMutexException('missing fencing token for key $key');
      }
      tokens[key] = _fence(raw[key], 'fencingTokens[$key]');
    }
    if (tokens.length != returnedKeys.length) {
      throw LiveMutexException('fencing token/key cardinality mismatch');
    }
    return AcquireManyGrant(
      keys: returnedKeys,
      lockUuid: (reply['lockUuid'] ?? '').toString(),
      fencingTokens: tokens,
    );
  }

  Future<void> releaseMany(String lockUuid) async {
    final reqUuid = _uuid.v4();
    final reply = await _awaitReply(reqUuid, {
      'type': 'release-many', 'uuid': reqUuid, 'lockUuid': lockUuid,
    });
    if (reply['released'] != true) {
      throw LiveMutexException(reply['error']?.toString() ?? 'release-many rejected');
    }
  }
}
