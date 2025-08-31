import { createClient } from '@supabase/supabase-js'

// TODO: Replace with actual environment variables from Vite
const supabaseUrl = 'https://your-project.supabase.co'
const supabaseAnonKey = 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// API base URL
export const API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:4000'
  : '/api'

export default supabase