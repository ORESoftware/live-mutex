// Minimal, dependency-free JSON for the live-mutex broker protocol.
//
// The broker speaks newline-delimited, flat-ish JSON objects (strings,
// numbers, bools, null, arrays of strings, and string->number maps), so
// this is a compact recursive-descent parser + serializer rather than a
// general library. Numbers are kept as their original text and parsed on
// demand so 64-bit fencing tokens never lose precision through a double.
#pragma once

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace lmx::json {

class Value;
using Array = std::vector<Value>;
using Object = std::map<std::string, Value>;

enum class Type { Null, Bool, Number, String, Array, Object };

class Value {
 public:
  Value() : type_(Type::Null) {}
  Value(std::nullptr_t) : type_(Type::Null) {}
  Value(bool b) : type_(Type::Bool), bool_(b) {}
  Value(const char* s) : type_(Type::String), str_(s) {}
  Value(std::string s) : type_(Type::String), str_(std::move(s)) {}
  Value(int64_t n) : type_(Type::Number), str_(std::to_string(n)) {}
  Value(uint64_t n) : type_(Type::Number), str_(std::to_string(n)) {}
  Value(int n) : type_(Type::Number), str_(std::to_string(n)) {}
  Value(Array a) : type_(Type::Array), arr_(std::move(a)) {}
  Value(Object o) : type_(Type::Object), obj_(std::move(o)) {}

  // Build a Number value preserving the exact source text (so large 64-bit
  // fencing tokens survive without going through a double).
  static Value number_raw(std::string text) {
    Value v;
    v.type_ = Type::Number;
    v.str_ = std::move(text);
    return v;
  }

  Type type() const { return type_; }
  bool is_null() const { return type_ == Type::Null; }

  bool as_bool() const { return bool_; }
  int64_t as_i64() const { return static_cast<int64_t>(std::strtoll(str_.c_str(), nullptr, 10)); }
  uint64_t as_u64() const { return static_cast<uint64_t>(std::strtoull(str_.c_str(), nullptr, 10)); }
  const std::string& as_string() const { return str_; }
  const Array& as_array() const { return arr_; }
  const Object& as_object() const { return obj_; }

  bool contains(const std::string& key) const {
    return type_ == Type::Object && obj_.find(key) != obj_.end();
  }
  const Value* find(const std::string& key) const {
    if (type_ != Type::Object) return nullptr;
    auto it = obj_.find(key);
    return it == obj_.end() ? nullptr : &it->second;
  }
  std::string str_or(const std::string& key, std::string def = "") const {
    const Value* v = find(key);
    return (v && v->type_ == Type::String) ? v->str_ : def;
  }
  bool bool_or(const std::string& key, bool def = false) const {
    const Value* v = find(key);
    return (v && v->type_ == Type::Bool) ? v->bool_ : def;
  }
  uint64_t u64_or(const std::string& key, uint64_t def = 0) const {
    const Value* v = find(key);
    return (v && v->type_ == Type::Number) ? v->as_u64() : def;
  }

  std::string dump() const {
    std::ostringstream os;
    write(os);
    return os.str();
  }

 private:
  void write(std::ostringstream& os) const {
    switch (type_) {
      case Type::Null: os << "null"; break;
      case Type::Bool: os << (bool_ ? "true" : "false"); break;
      case Type::Number: os << str_; break;
      case Type::String: write_string(os, str_); break;
      case Type::Array: {
        os << '[';
        for (size_t i = 0; i < arr_.size(); ++i) {
          if (i) os << ',';
          arr_[i].write(os);
        }
        os << ']';
        break;
      }
      case Type::Object: {
        os << '{';
        bool first = true;
        for (const auto& [k, v] : obj_) {
          if (!first) os << ',';
          first = false;
          write_string(os, k);
          os << ':';
          v.write(os);
        }
        os << '}';
        break;
      }
    }
  }

  static void write_string(std::ostringstream& os, const std::string& s) {
    os << '"';
    for (char c : s) {
      switch (c) {
        case '"': os << "\\\""; break;
        case '\\': os << "\\\\"; break;
        case '\n': os << "\\n"; break;
        case '\r': os << "\\r"; break;
        case '\t': os << "\\t"; break;
        default:
          if (static_cast<unsigned char>(c) < 0x20) {
            char buf[8];
            std::snprintf(buf, sizeof(buf), "\\u%04x", c);
            os << buf;
          } else {
            os << c;
          }
      }
    }
    os << '"';
  }

  Type type_;
  bool bool_ = false;
  std::string str_;
  Array arr_;
  Object obj_;
};

class ParseError : public std::runtime_error {
 public:
  explicit ParseError(const std::string& m) : std::runtime_error(m) {}
};

class Parser {
 public:
  explicit Parser(const std::string& s) : s_(s) {}

  Value parse() {
    skip_ws();
    Value v = parse_value();
    skip_ws();
    return v;
  }

 private:
  const std::string& s_;
  size_t i_ = 0;

  void skip_ws() {
    while (i_ < s_.size() && (s_[i_] == ' ' || s_[i_] == '\t' || s_[i_] == '\n' || s_[i_] == '\r')) ++i_;
  }

  char peek() {
    if (i_ >= s_.size()) throw ParseError("unexpected end of JSON");
    return s_[i_];
  }

  Value parse_value() {
    char c = peek();
    switch (c) {
      case '{': return parse_object();
      case '[': return parse_array();
      case '"': return Value(parse_string());
      case 't': case 'f': return parse_bool();
      case 'n': return parse_null();
      default: return parse_number();
    }
  }

  Value parse_object() {
    Object obj;
    ++i_;  // {
    skip_ws();
    if (peek() == '}') { ++i_; return Value(std::move(obj)); }
    while (true) {
      skip_ws();
      std::string key = parse_string();
      skip_ws();
      if (peek() != ':') throw ParseError("expected ':'");
      ++i_;
      skip_ws();
      obj[key] = parse_value();
      skip_ws();
      char c = peek();
      if (c == ',') { ++i_; continue; }
      if (c == '}') { ++i_; break; }
      throw ParseError("expected ',' or '}'");
    }
    return Value(std::move(obj));
  }

  Value parse_array() {
    Array arr;
    ++i_;  // [
    skip_ws();
    if (peek() == ']') { ++i_; return Value(std::move(arr)); }
    while (true) {
      skip_ws();
      arr.push_back(parse_value());
      skip_ws();
      char c = peek();
      if (c == ',') { ++i_; continue; }
      if (c == ']') { ++i_; break; }
      throw ParseError("expected ',' or ']'");
    }
    return Value(std::move(arr));
  }

  std::string parse_string() {
    if (peek() != '"') throw ParseError("expected string");
    ++i_;
    std::string out;
    while (i_ < s_.size()) {
      char c = s_[i_++];
      if (c == '"') return out;
      if (c == '\\') {
        if (i_ >= s_.size()) throw ParseError("bad escape");
        char e = s_[i_++];
        switch (e) {
          case '"': out.push_back('"'); break;
          case '\\': out.push_back('\\'); break;
          case '/': out.push_back('/'); break;
          case 'n': out.push_back('\n'); break;
          case 'r': out.push_back('\r'); break;
          case 't': out.push_back('\t'); break;
          case 'b': out.push_back('\b'); break;
          case 'f': out.push_back('\f'); break;
          case 'u': {
            if (i_ + 4 > s_.size()) throw ParseError("bad \\u escape");
            unsigned code = std::stoul(s_.substr(i_, 4), nullptr, 16);
            i_ += 4;
            if (code < 0x80) {
              out.push_back(static_cast<char>(code));
            } else if (code < 0x800) {
              out.push_back(static_cast<char>(0xC0 | (code >> 6)));
              out.push_back(static_cast<char>(0x80 | (code & 0x3F)));
            } else {
              out.push_back(static_cast<char>(0xE0 | (code >> 12)));
              out.push_back(static_cast<char>(0x80 | ((code >> 6) & 0x3F)));
              out.push_back(static_cast<char>(0x80 | (code & 0x3F)));
            }
            break;
          }
          default: throw ParseError("unknown escape");
        }
      } else {
        out.push_back(c);
      }
    }
    throw ParseError("unterminated string");
  }

  Value parse_bool() {
    if (s_.compare(i_, 4, "true") == 0) { i_ += 4; return Value(true); }
    if (s_.compare(i_, 5, "false") == 0) { i_ += 5; return Value(false); }
    throw ParseError("invalid literal");
  }

  Value parse_null() {
    if (s_.compare(i_, 4, "null") == 0) { i_ += 4; return Value(nullptr); }
    throw ParseError("invalid literal");
  }

  Value parse_number() {
    size_t start = i_;
    while (i_ < s_.size()) {
      char c = s_[i_];
      if ((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E') {
        ++i_;
      } else {
        break;
      }
    }
    if (i_ == start) throw ParseError("invalid number");
    return Value::number_raw(s_.substr(start, i_ - start));
  }
};

}  // namespace lmx::json
