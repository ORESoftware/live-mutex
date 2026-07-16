import 'dart:io';

import 'package:live_mutex_client/live_mutex_client.dart';

Future<void> main() async {
  final host = Platform.environment['LMX_HOST'] ?? '127.0.0.1';
  final port = int.tryParse(Platform.environment['LMX_PORT'] ?? '') ?? 6970;

  final client = await Client.connect(host: host, port: port);

  try {
    final g1 = await client.acquire('dart-smoke', ttlMs: 5000);
    print('acquire #1: lockUuid=${g1.lockUuid} fencingToken=${g1.fencingToken}');
    if (g1.fencingToken == null || g1.fencingToken! < 1) {
      throw StateError('missing fencing token');
    }
    await client.release('dart-smoke', g1.lockUuid);

    final g2 = await client.acquire('dart-smoke');
    print('acquire #2: lockUuid=${g2.lockUuid} fencingToken=${g2.fencingToken}');
    if (g2.fencingToken == null || g2.fencingToken! <= g1.fencingToken!) {
      throw StateError('fencing tokens must be strictly monotonic per key');
    }
    await client.release('dart-smoke', g2.lockUuid);

    final many = await client.acquireMany(
      ['dart-many-a', 'dart-many-b', 'dart-many-c'],
      ttlMs: 5000,
    );
    print('acquire_many: lockUuid=${many.lockUuid} fencingTokens=${many.fencingTokens}');
    if (many.fencingTokens.length != 3) {
      throw StateError('expected one token per key');
    }
    await client.releaseMany(many.lockUuid);

    print('\u2705 dart client smoke test passed');
  } finally {
    await client.close();
  }
}
