/// Dart client for the live-mutex broker.
///
/// Speaks the broker's NDJSON-over-TCP wire protocol. A single Client
/// multiplexes many concurrent acquire/release/acquire-many requests
/// over one connection by correlating on a per-request UUID.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:uuid/uuid.dart';

const String protocolVersion = '0.2.25';

/// Outcome of a successful acquire.
class LockGrant {
  final String key;
  final String lockUuid;
  final int? fencingToken;
  final int? lockRequestCount;
  LockGrant({
    required this.key,
    required this.lockUuid,
    this.fencingToken,
    this.lockRequestCount,
  });
}

/// Outcome of a successful acquireMany.
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

class LiveMutexException implements Exception {
  final String message;
  LiveMutexException(this.message);
  @override
  String toString() => 'LiveMutexException: $message';
}

class Client {
  final Socket _socket;
  final Map<String, Completer<Map<String, dynamic>>> _inflight = {};
  final Duration requestTimeout;
  final Uuid _uuid = const Uuid();
  bool _closed = false;

  Client._(this._socket, this.requestTimeout) {
    // The socket is already in line-buffered mode (utf8.decode then
    // LineSplitter) by the time we construct the client. The reader
    // chain is set up in `connect`.
  }

  /// Connect to a broker and send the version handshake.
  static Future<Client> connect({
    String host = '127.0.0.1',
    int port = 6970,
    Duration requestTimeout = const Duration(seconds: 60),
  }) async {
    final socket = await Socket.connect(host, port);
    // TCP_NODELAY mirrors the canonical broker default.
    socket.setOption(SocketOption.tcpNoDelay, true);
    final client = Client._(socket, requestTimeout);

    // Set up the reader pipeline before sending the handshake to
    // avoid losing any pre-handshake replies (e.g. version-mismatch).
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
    if (line.isEmpty) return;
    final dynamic decoded;
    try {
      decoded = jsonDecode(line);
    } catch (_) {
      return;
    }
    if (decoded is! Map<String, dynamic>) return;
    final uuid = decoded['uuid'];
    if (uuid is! String) return;
    final completer = _inflight.remove(uuid);
    if (completer != null && !completer.isCompleted) {
      completer.complete(decoded);
    }
  }

  void _closeWithError() {
    if (_closed) return;
    _closed = true;
    for (final c in _inflight.values) {
      if (!c.isCompleted) {
        c.completeError(LiveMutexException('connection closed'));
      }
    }
    _inflight.clear();
  }

  Future<void> close() async {
    if (_closed) return;
    _closed = true;
    try {
      await _socket.flush();
    } catch (_) {/* ignore */}
    try {
      await _socket.close();
    } catch (_) {/* ignore */}
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
      'type': 'lock',
      'uuid': reqUuid,
      'key': key,
      'ttl': ttlMs,
      'pid': pid,
      'keepLocksAfterDeath': false,
    };
    if (max != null) payload['max'] = max;
    final reply = await _awaitReply(reqUuid, payload);
    if (reply['acquired'] != true) {
      throw LiveMutexException(reply['error']?.toString() ?? 'lock not acquired');
    }
    return LockGrant(
      key: key,
      lockUuid: reqUuid,
      fencingToken: (reply['fencingToken'] as num?)?.toInt(),
      lockRequestCount: (reply['lockRequestCount'] as num?)?.toInt(),
    );
  }

  Future<void> release(String key, String lockUuid, {bool force = false}) async {
    final reqUuid = _uuid.v4();
    final payload = <String, dynamic>{
      'type': 'unlock',
      'uuid': reqUuid,
      '_uuid': lockUuid,
      'key': key,
      'force': force,
    };
    final reply = await _awaitReply(reqUuid, payload);
    if (reply['unlocked'] != true) {
      throw LiveMutexException(reply['error']?.toString() ?? 'unlock rejected');
    }
  }

  Future<AcquireManyGrant> acquireMany(List<String> keys, {int? ttlMs}) async {
    if (keys.isEmpty) {
      throw ArgumentError('acquireMany requires at least one key');
    }
    final reqUuid = _uuid.v4();
    final payload = <String, dynamic>{
      'type': 'acquire-many',
      'uuid': reqUuid,
      'keys': keys,
      'ttl': ttlMs,
    };
    final reply = await _awaitReply(reqUuid, payload);
    if (reply['acquired'] != true) {
      final why = reply['error'] ?? (reply['contendedKey'] != null
          ? 'contended on ${reply['contendedKey']}'
          : 'acquire-many rejected');
      throw LiveMutexException(why.toString());
    }
    final tokens = <String, int>{};
    final raw = reply['fencingTokens'];
    if (raw is Map) {
      raw.forEach((k, v) {
        if (v is num) tokens[k.toString()] = v.toInt();
      });
    }
    final returnedKeys = (reply['keys'] is List)
        ? (reply['keys'] as List).map((e) => e.toString()).toList()
        : List<String>.from(keys);
    return AcquireManyGrant(
      keys: returnedKeys,
      lockUuid: (reply['lockUuid'] ?? '').toString(),
      fencingTokens: tokens,
    );
  }

  Future<void> releaseMany(String lockUuid) async {
    final reqUuid = _uuid.v4();
    final payload = <String, dynamic>{
      'type': 'release-many',
      'uuid': reqUuid,
      'lockUuid': lockUuid,
    };
    final reply = await _awaitReply(reqUuid, payload);
    if (reply['released'] != true) {
      throw LiveMutexException(reply['error']?.toString() ?? 'release-many rejected');
    }
  }
}
