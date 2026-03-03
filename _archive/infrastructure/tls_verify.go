package main

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
)

// Heady mTLS Terminator
// Validates Hardware-Bound Heady Ecosystem Client Certificates at the edge.
// Drops all unauthorized TCP/IP connections making the admin center a "dark" network.

func main() {
	// 1. Load the CA certificate used to sign client certificates
	caCert, err := ioutil.ReadFile("/etc/heady/certs/ca.crt")
	if err != nil {
		log.Fatalf("Error reading CA cert: %v", err)
	}

	caCertPool := x509.NewCertPool()
	caCertPool.AppendCertsFromPEM(caCert)

	// 2. Setup TLS configuration to REQUIRE client certificates (mTLS)
	tlsConfig := &tls.Config{
		ClientCAs:  caCertPool,
		ClientAuth: tls.RequireAndVerifyClientCert,
		MinVersion: tls.VersionTLS13,
	}

	// 3. Setup the HTTP Server
	server := &http.Server{
		Addr:      ":8443", // Edge proxy port
		TLSConfig: tlsConfig,
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// If we reach here, the mTLS handshake has succeeded
		// The connection holds a valid Heady Ecosystem Client Certificate.
		fmt.Fprintf(w, "HeadyMe Secure Admin Enclave - mTLS Authenticated\n")
		// Reverse proxy logic to backend would go here
	})

	log.Println("Starting Heady mTLS terminator on :8443 (Dark Network Mode)")
	// Serve with Server's Certificate and Key
	err = server.ListenAndServeTLS("/etc/heady/certs/server.crt", "/etc/heady/certs/server.key")
	if err != nil {
		log.Fatalf("mTLS Server Error: %v", err)
	}
}
