use live_mutex_client::PROTOCOL_VERSION;

#[test]
fn portable_client_protocol_matches_broker_package_version() {
    let package: serde_json::Value = serde_json::from_str(include_str!("../../../package.json"))
        .expect("root package.json must remain valid JSON");
    let broker_version = package
        .get("version")
        .and_then(serde_json::Value::as_str)
        .expect("root package.json must contain a string version");

    assert_eq!(
        PROTOCOL_VERSION, broker_version,
        "the Rust client's version handshake must advance with the broker package",
    );
}
