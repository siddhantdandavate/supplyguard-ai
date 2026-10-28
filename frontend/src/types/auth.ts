export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'planner' | 'admin' | 'viewer';
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  full_name: string;
  role?: string;
}
