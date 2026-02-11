import os
import requests

class HeadyClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })

    def get(self, endpoint):
        response = self.session.get(f'{self.base_url}{endpoint}')
        response.raise_for_status()
        return response.json()

    # Add other HTTP methods as needed
    def post(self, endpoint, data):
        response = self.session.post(f'{self.base_url}{endpoint}', json=data)
        response.raise_for_status()
        return response.json()
    def put(self, endpoint, data):
        """Update a resource at the specified endpoint."""
        response = self.session.put(f'{self.base_url}{endpoint}', json=data)
        response.raise_for_status()
        return response.json()

    def delete(self, endpoint):
        """Delete a resource at the specified endpoint."""
        response = self.session.delete(f'{self.base_url}{endpoint}')
        response.raise_for_status()
        return response.json()

    def patch(self, endpoint, data):
        """Partially update a resource at the specified endpoint."""
        response = self.session.patch(f'{self.base_url}{endpoint}', json=data)
        response.raise_for_status()
        return response.json()

    def health_check(self):
        """Check if the API service is healthy and reachable."""
        try:
            response = self.session.get(f'{self.base_url}/health', timeout=5)
            return response.status_code == 200
        except requests.RequestException:
            return False

    def set_timeout(self, timeout):
        """Set request timeout for all subsequent requests."""
        self.timeout = timeout
        self.session.request = lambda *args, **kwargs: requests.Session.request(
            self.session, *args, timeout=self.timeout, **kwargs
        )

    def get_headers(self):
        """Get current session headers."""
        return dict(self.session.headers)

    def update_headers(self, headers):
        """Update session headers with new values."""
        self.session.headers.update(headers)

    def close(self):
        """Close the session and release resources."""
        self.session.close()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - ensures session is closed."""
        self.close()
        return False
