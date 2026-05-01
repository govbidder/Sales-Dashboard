// ── MOCK CLIENT — no external connections ─────────────────────────────────────
// All auth calls return a hardcoded demo admin session.
// All DB queries return empty arrays / null rows.
// Replace with real Supabase client when ready to connect.

const MOCK_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "demo@govbidder.com",
  app_metadata: { role: "admin" },
  user_metadata: { role: "admin", name: "Demo Admin" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
}

// Minimal valid JWT with app_metadata.role = "admin"
const MOCK_TOKEN = [
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
  btoa(JSON.stringify({ sub: MOCK_USER.id, email: MOCK_USER.email, app_metadata: { role: "admin" }, user_metadata: { role: "admin" }, exp: 9999999999 }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  "mock-sig",
].join(".")

const MOCK_SESSION = {
  access_token: MOCK_TOKEN,
  refresh_token: "mock-refresh",
  expires_in: 3600,
  token_type: "bearer",
  user: MOCK_USER,
}

function makeBuilder(data: any = [], single: any = null): any {
  const b: any = {
    data,
    error: null,
    then(res: any, rej: any) {
      return Promise.resolve({ data: b.data, error: null }).then(res, rej)
    },
    eq()       { return b },
    neq()      { return b },
    gt()       { return b },
    lt()       { return b },
    gte()      { return b },
    lte()      { return b },
    like()     { return b },
    ilike()    { return b },
    in()       { return b },
    is()       { return b },
    not()      { return b },
    or()       { return b },
    filter()   { return b },
    order()    { return b },
    limit()    { return b },
    range()    { return b },
    select()   { return b },
    returns()  { return b },
    single()   { return Promise.resolve({ data: single, error: null }) },
    maybeSingle() { return Promise.resolve({ data: single, error: null }) },
  }
  return b
}

export function createClient() {
  return {
    auth: {
      getSession:            async () => ({ data: { session: MOCK_SESSION }, error: null }),
      getUser:               async () => ({ data: { user: MOCK_USER }, error: null }),
      setSession:            async () => ({ data: { session: MOCK_SESSION, user: MOCK_USER }, error: null }),
      signOut:               async () => ({ error: null }),
      signInWithPassword:    async () => ({ data: { session: MOCK_SESSION, user: MOCK_USER }, error: null }),
      signUp:                async () => ({ data: { session: MOCK_SESSION, user: MOCK_USER }, error: null }),
      updateUser:            async () => ({ data: { user: MOCK_USER }, error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      resend:                async () => ({ data: {}, error: null }),
      verifyOtp:             async () => ({ data: { session: MOCK_SESSION, user: MOCK_USER }, error: null }),
      exchangeCodeForSession:async () => ({ data: { session: MOCK_SESSION, user: MOCK_USER }, error: null }),
      onAuthStateChange:     (_: any, cb: any) => {
        cb("SIGNED_IN", MOCK_SESSION)
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
    from: (_table: string) => ({
      select:  (_cols?: string) => makeBuilder(),
      insert:  (_rows: any)    => makeBuilder(),
      update:  (_vals: any)    => makeBuilder(),
      upsert:  (_rows: any)    => makeBuilder(),
      delete:  ()              => makeBuilder(),
    }),
    storage: {
      from: (_bucket: string) => ({
        upload:       async () => ({ data: null, error: null }),
        download:     async () => ({ data: null, error: null }),
        getPublicUrl: ()       => ({ data: { publicUrl: "" } }),
      }),
    },
    rpc: async (_fn: string) => ({ data: null, error: null }),
  }
}
