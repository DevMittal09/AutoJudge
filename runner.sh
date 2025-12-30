#!/bin/bash
set -u

WORKDIR=/submission
OUTDIR=$WORKDIR/out
mkdir -p "$WORKDIR" "$OUTDIR"
cd "$WORKDIR"

LANG=${LANGUAGE:-python}
TIMEOUT_SECONDS=${TIMEOUT_SECONDS:-2}
MODE=${EXECUTION_MODE:-submit} # Default to 'submit' if not set

# 1. Decode Code
if [ -n "${CODE_B64:-}" ]; then
  echo "$CODE_B64" | base64 -d > code
else
  echo "Error: CODE_B64 missing" >&2; exit 1
fi

# 2. Compilation (Common for both modes)
COMPILE_ERROR=""
case "$LANG" in
  python)
    RUN_CMD="python3 code"
    ;;
  cpp)
    g++ -std=c++17 code -O2 -o main 2> compile.err
    if [ $? -ne 0 ]; then
        COMPILE_ERROR=$(cat compile.err | base64 -w 0)
    fi
    RUN_CMD="./main"
    ;;
esac

# Return Compilation Error immediately if exists
if [ -n "$COMPILE_ERROR" ]; then
    echo "###JSON_START###"
    echo "[{\"status\": \"Compilation Error\", \"error\": \"$COMPILE_ERROR\"}]"
    echo "###JSON_END###"
    exit 0
fi

# --- MODE: RUN (Custom Input) ---
if [ "$MODE" = "run" ]; then
    # Decode single custom input
    if [ -n "${INPUTS_B64:-}" ]; then 
        echo "$INPUTS_B64" | base64 -d > input.txt 
    else
        touch input.txt
    fi

    START_TIME=$(python3 -c 'import time; print(time.time())')
    
    # Run with input redirection
    user_output=$(cat input.txt | timeout "${TIMEOUT_SECONDS}s" bash -c "$RUN_CMD" 2>&1)
    EXIT_CODE=$?
    
    END_TIME=$(python3 -c 'import time; print(time.time())')
    DURATION_SEC=$(python3 -c "print(f'{($END_TIME - $START_TIME):.3f}')")
    
    STATUS="Completed"
    if [ $EXIT_CODE -eq 124 ]; then STATUS="TLE"; fi
    # 139 is segfault, non-zero is generic runtime error
    if [ $EXIT_CODE -ne 0 ] && [ $EXIT_CODE -ne 124 ]; then STATUS="Runtime Error"; fi

    B64_OUT=$(echo "$user_output" | base64 -w 0)
    
    # Return simplified JSON for single run
    echo "###JSON_START###"
    echo "[{\"status\": \"$STATUS\", \"time\": $DURATION_SEC, \"output_b64\": \"$B64_OUT\"}]"
    echo "###JSON_END###"
    exit 0
fi

# --- MODE: SUBMIT (Test Cases) ---
# Only decode inputs/outputs if in submit mode to avoid conflicts
if [ -n "${INPUTS_B64:-}" ]; then echo "$INPUTS_B64" | base64 -d > inputs.txt; fi
if [ -n "${EXPECTED_B64:-}" ]; then echo "$EXPECTED_B64" | base64 -d > outputs.txt; fi

JSON_RESULTS="["
TOTAL_PASSED=0
TOTAL_CASES=0

# Parse Test Cases
DELIMITER=$'\n---\n'
mapfile -d '' -t inputs < <(awk -v RS="$DELIMITER" 'BEGIN{ORS="\0"} NR>0{print}' inputs.txt)
mapfile -d '' -t outputs < <(awk -v RS="$DELIMITER" 'BEGIN{ORS="\0"} NR>0{print}' outputs.txt)

# Execute Test Cases
for i in "${!inputs[@]}"; do
    test_num=$((i + 1))
    TOTAL_CASES=$((TOTAL_CASES + 1))
    
    c_input=$(echo -e "${inputs[$i]}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    c_expected=$(echo -e "${outputs[$i]}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

    START_TIME=$(python3 -c 'import time; print(time.time())')
    user_output=$(echo -e "$c_input" | timeout "${TIMEOUT_SECONDS}s" bash -c "$RUN_CMD" 2>&1)
    EXIT_CODE=$?
    END_TIME=$(python3 -c 'import time; print(time.time())')
    DURATION_SEC=$(python3 -c "print(f'{($END_TIME - $START_TIME):.3f}')")

    STATUS="Failed"
    if [ $EXIT_CODE -eq 124 ]; then
        STATUS="TLE"
    elif [ $EXIT_CODE -ne 0 ]; then
        STATUS="Runtime Error"
    else
        if diff -wB <(echo "$user_output") <(echo "$c_expected") > /dev/null; then
            STATUS="Passed"
            TOTAL_PASSED=$((TOTAL_PASSED + 1))
        fi
    fi

    B64_IN=$(echo "$c_input" | base64 -w 0)
    B64_OUT=$(echo "$user_output" | base64 -w 0)
    B64_EXP=$(echo "$c_expected" | base64 -w 0)

    [ "$i" -ne 0 ] && JSON_RESULTS="$JSON_RESULTS,"
    JSON_RESULTS="$JSON_RESULTS {\"test_case\": $test_num, \"status\": \"$STATUS\", \"time\": $DURATION_SEC, \"input_b64\": \"$B64_IN\", \"output_b64\": \"$B64_OUT\", \"expected_b64\": \"$B64_EXP\"}"
done

JSON_RESULTS="$JSON_RESULTS]"

echo "-----------------------------"
echo "Passed $TOTAL_PASSED / $TOTAL_CASES test cases"
echo "-----------------------------"

echo "###JSON_START###"
echo "$JSON_RESULTS"
echo "###JSON_END###"