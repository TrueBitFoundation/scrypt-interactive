cmake_minimum_required(VERSION 3.2)

project(scrypthash)

set (CMAKE_CXX_STANDARD 11)

find_package(OpenSSL)
include_directories(${OPENSSL_INCLUDE_DIRS})

add_executable(scrypthash scrypthash.cpp scrypt.cpp)

target_link_libraries (scrypthash ${OPENSSL_LIBRARIES})

