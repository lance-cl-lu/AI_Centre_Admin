package main

import (
	"fmt"
	"os"
	"strings"
)

func main() {

	// Environ returns a copy of strings representing the environment,
	// in the form "key=value".
	for _, env := range os.Environ() {
		pair := strings.SplitN(env, "=", 2)
		fmt.Println(pair[0], "=", pair[1])
	}

	// Delete all environment variables
	os.Clearenv()

	fmt.Println("Number of environment variables: ", len(os.Environ()))
}
