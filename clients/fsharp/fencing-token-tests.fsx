#load "src/fsharp/Library.fs"

open LiveMutex

let fail message = failwith message

let expectOk expected result =
    match result with
    | Ok token when FencingToken.value token = expected -> ()
    | Ok token -> fail (sprintf "expected fencing token %A, got %A" expected (FencingToken.value token))
    | Error message -> fail (sprintf "expected valid fencing token, got error: %s" message)

let expectError result =
    match result with
    | Error _ -> ()
    | Ok token -> fail (sprintf "expected fencing rejection, got %A" (FencingToken.value token))

// Preserve large integer authority exactly; do not route through floating point.
expectOk 9007199254740991UL (Fencing.validateToken (Some 9007199254740991UL))
expectError (Fencing.validateToken None)
expectError (Fencing.validateToken (Some 0UL))

let raw = Map.ofList [ "alpha", 5UL; "beta", 12UL ]
match Fencing.validateCompositeTokens [ "alpha"; "beta" ] raw with
| Error message -> fail (sprintf "expected composite fencing authority, got: %s" message)
| Ok tokens ->
    if FencingToken.value tokens.["alpha"] <> 5UL then fail "alpha fencing authority changed"
    if FencingToken.value tokens.["beta"] <> 12UL then fail "beta fencing authority changed"

match Fencing.validateCompositeTokens [ "alpha"; "beta" ] (Map.ofList [ "alpha", 5UL ]) with
| Error _ -> ()
| Ok _ -> fail "missing per-key fencing authority was accepted"

match Fencing.validateCompositeTokens [ "alpha" ] (Map.ofList [ "alpha", 0UL ]) with
| Error _ -> ()
| Ok _ -> fail "zero composite fencing authority was accepted"

printfn "F# fencing-token checks passed"
