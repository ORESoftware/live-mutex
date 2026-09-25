namespace LiveMutex

/// Broker-issued authority for writes protected by a live-mutex lease.
/// The private case prevents callers from manufacturing zero/invalid fences.
type FencingToken = private FencingToken of uint64

module FencingToken =
    let wireName = "fencingToken"

    let tryCreate (value: uint64) =
        if value = 0UL then
            Error "fencingToken must be a positive broker-issued integer"
        else
            Ok (FencingToken value)

    let value (FencingToken value) = value

/// A successfully decoded single-key lock grant.
type LockGrant = {
    Key: string
    LockUuid: string
    FencingToken: FencingToken
}

/// A successfully decoded composite grant. Fences are scoped by key and must
/// never be interchanged between keys.
type CompositeLockGrant = {
    Keys: string list
    LockUuid: string
    FencingTokens: Map<string, FencingToken>
}

module Fencing =
    let compositeWireName = "fencingTokens"

    /// Fail closed when a decoder receives a missing, zero, or otherwise
    /// unusable single-key authority value.
    let validateToken (raw: uint64 option) =
        match raw with
        | None -> Error "missing fencingToken"
        | Some value -> FencingToken.tryCreate value

    /// Validate each per-key authority and require exactly one fence for every
    /// requested key. This preserves key scope for multi-key grants.
    let validateCompositeTokens (keys: string list) (raw: Map<string, uint64>) =
        if List.isEmpty keys then
            Error "composite grant must contain at least one key"
        elif Set.ofList keys |> Set.count <> List.length keys then
            Error "composite grant keys must be unique"
        elif raw.Count <> List.length keys then
            Error "fencingTokens must contain exactly one token per key"
        else
            keys
            |> List.fold (fun state key ->
                match state with
                | Error _ as error -> error
                | Ok tokens ->
                    match Map.tryFind key raw with
                    | None -> Error (sprintf "missing fencingToken for key %s" key)
                    | Some value ->
                        match FencingToken.tryCreate value with
                        | Error message -> Error (sprintf "%s for key %s" message key)
                        | Ok token -> Ok (Map.add key token tokens)
            ) (Ok Map.empty)
