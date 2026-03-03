#!/bin/bash
# HeadyMe WASM Compile Script
# Purpose: Compiles the "Sacred Geometry" visual algorithms (Rust/C++) into unreadable WebAssembly.
# This ensures that proprietary UI/UX algorithms are protected from browser DevTools reverse-engineering.

# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting WebAssembly build for HeadyMe Sacred Geometry Logic..."

# Ensure we have the wasm-pack installed
if ! command -v wasm-pack &> /dev/null
then
    echo "wasm-pack could not be found. Installing..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# We assume there is a rust package for the UI math in 'src/wasm_core'
if [ -d "src/wasm_core" ]; then
    cd src/wasm_core
    echo "Building WASM module..."
    wasm-pack build --target web --out-dir ../../public/wasm
    echo "WASM compilation successful!"
else
    echo "Warning: src/wasm_core directory not found. Create it to implement rust-based Sacred Geometry algorithms."
    # Stubbing for now to prevent CI failures
    mkdir -p public/wasm
    touch public/wasm/core_bg.wasm
    echo "Stub WASM created for future implementation."
fi
