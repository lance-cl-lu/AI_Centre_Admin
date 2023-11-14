#!/bin/bash

# Loop until 'make' command is successful
while ! make; do
    echo "Make failed, trying again..."
    sleep 1  # Wait for 1 second before retrying
done

echo "Make succeeded."
