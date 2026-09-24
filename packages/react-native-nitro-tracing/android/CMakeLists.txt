project(NitroTracing)
cmake_minimum_required(VERSION 3.9.0)

set (PACKAGE_NAME NitroTracing)
set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)

# Define C++ library and add all sources
add_library(${PACKAGE_NAME} SHARED
        src/main/cpp/cpp-adapter.cpp
        ../cpp/HybridTracing.cpp
        ../cpp/HybridRecording.cpp
        ../cpp/HybridTraceSpan.cpp
        ../cpp/HermesSampling.cpp
        ../cpp/NativeConversions.cpp
        ../cpp/core/Recorder.cpp
        ../cpp/core/Retention.cpp
        ../cpp/core/TraceJson.cpp
        ../cpp/core/NativeSampler.cpp
)

# Add Nitrogen specs :)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NitroTracing+autolinking.cmake)

# Set up local includes
include_directories(
        "src/main/cpp"
        "../cpp"
)

find_library(LOG_LIB log)

# Link all libraries together
target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        android                                   # <-- Android core
)

# Hermes C++ API, to stop the sampling profiler correctly (see cpp/HermesSampling.cpp).
# Optional: without Hermes the library builds and disableHermesSampling() returns false.
find_package(hermes-engine CONFIG)
if(TARGET hermes-engine::hermesvm)
  target_link_libraries(${PACKAGE_NAME} hermes-engine::hermesvm)
  target_compile_definitions(${PACKAGE_NAME} PRIVATE NITRO_TRACING_HERMES=1)
elseif(TARGET hermes-engine::libhermes)
  target_link_libraries(${PACKAGE_NAME} hermes-engine::libhermes)
  target_compile_definitions(${PACKAGE_NAME} PRIVATE NITRO_TRACING_HERMES=1)
endif()
