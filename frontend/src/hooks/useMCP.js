import { useState, useEffect } from 'react';
import axios from 'axios';

export const useMCPTools = () => {
  const [tools, setTools] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTools = async () => {
      setStatus('loading');
      try {
        const response = await axios.get('/api/mcp/tools');
        setTools(response.data);
        setStatus('success');
      } catch (err) {
        setError(err);
        setStatus('error');
      }
    };

    fetchTools();
  }, []);

  return { tools, status, error };
};
