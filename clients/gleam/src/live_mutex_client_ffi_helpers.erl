-module(live_mutex_client_ffi_helpers).

-export([getenv/1]).

getenv(Name0) ->
    Name = case Name0 of
        N when is_binary(N) -> binary_to_list(N);
        N when is_list(N) -> N
    end,
    case os:getenv(Name) of
        false -> {error, nil};
        "" -> {error, nil};
        Value -> {ok, list_to_binary(Value)}
    end.
