# C++ client for the live-mutex broker.
#
#   make test    # offline protocol round-trip tests (no broker)
#   make smoke   # build the live smoke binary -> build/smoke
#   make run     # build + run the smoke (needs a broker on $LMX_PORT)
#
# Requires a C++17 compiler (clang++ or g++). cmake is optional; this Makefile
# compiles the header-only client directly.

CXX ?= c++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra -Iinclude
LDFLAGS ?= -pthread
BUILD := build

.PHONY: all test smoke run
all: test smoke

$(BUILD):
	mkdir -p $(BUILD)

$(BUILD)/test_protocol: test_protocol.cpp include/live_mutex/*.hpp | $(BUILD)
	$(CXX) $(CXXFLAGS) test_protocol.cpp -o $@ $(LDFLAGS)

$(BUILD)/smoke: smoke.cpp include/live_mutex/*.hpp | $(BUILD)
	$(CXX) $(CXXFLAGS) smoke.cpp -o $@ $(LDFLAGS)

test: $(BUILD)/test_protocol
	./$(BUILD)/test_protocol

smoke: $(BUILD)/smoke

run: $(BUILD)/smoke
	./$(BUILD)/smoke
