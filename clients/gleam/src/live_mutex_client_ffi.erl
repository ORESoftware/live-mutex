%%% TCP transport FFI for the Gleam client. Uses plain gen_tcp in
%%% {packet, line} mode so each newline-delimited JSON frame comes back as a
%%% single message — the Gleam side then pattern-matches on the parsed
%%% Response variant.

-module(live_mutex_client_ffi).

-export([
    new_uuid/0,
    getpid/0,
    connect/3,
    close/1,
    send_line/2,
    recv_line/2
]).

new_uuid() ->
    <<A:32, B:16, C:16, D:16, E:48>> = crypto:strong_rand_bytes(16),
    %% Set v4 + variant bits
    C1 = (C band 16#0fff) bor 16#4000,
    D1 = (D band 16#3fff) bor 16#8000,
    Hex = io_lib:format("~8.16.0b-~4.16.0b-~4.16.0b-~4.16.0b-~12.16.0b",
                        [A, B, C1, D1, E]),
    iolist_to_binary(Hex).

getpid() ->
    list_to_integer(os:getpid()).

connect(Host0, Port, TimeoutMs) ->
    Host = case Host0 of
        H when is_binary(H) -> binary_to_list(H);
        H when is_list(H) -> H
    end,
    Opts = [
        binary,
        {active, false},
        {packet, line},
        {nodelay, true}
    ],
    case gen_tcp:connect(Host, Port, Opts, TimeoutMs) of
        {ok, Sock} -> {ok, Sock};
        {error, Reason} -> {error, format_error(Reason)}
    end.

close(Sock) ->
    _ = gen_tcp:close(Sock),
    nil.

send_line(Sock, Line0) ->
    Line = case Line0 of
        L when is_binary(L) -> L;
        L when is_list(L) -> iolist_to_binary(L)
    end,
    case gen_tcp:send(Sock, [Line, $\n]) of
        ok -> {ok, nil};
        {error, Reason} -> {error, format_error(Reason)}
    end.

recv_line(Sock, TimeoutMs) ->
    case gen_tcp:recv(Sock, 0, TimeoutMs) of
        {ok, Line0} ->
            Line = strip_newline(Line0),
            {ok, Line};
        {error, Reason} ->
            {error, format_error(Reason)}
    end.

strip_newline(<<>>) -> <<>>;
strip_newline(B) when is_binary(B) ->
    Sz = byte_size(B),
    case binary:at(B, Sz - 1) of
        $\n -> binary:part(B, 0, Sz - 1);
        _ -> B
    end.

format_error(Reason) ->
    iolist_to_binary(io_lib:format("~p", [Reason])).
