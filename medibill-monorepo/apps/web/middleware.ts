import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Inicializamos la respuesta base de Next.js
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 2. Creamos el cliente de Supabase específico para el Middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. getUser() va a la base de datos y confirma que el token no sea inventado o expirado
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginPage = request.nextUrl.pathname.startsWith('/login')

  // 4. REGLA A: Si NO hay usuario y quiere entrar a cualquier lado que no sea el login, lo pateamos al login.
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 5. REGLA B: Si SÍ hay usuario, y por error intenta ir a /login, lo redirigimos a la app principal.
  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // 6. Si todo está en orden, lo dejamos pasar.
  return supabaseResponse
}

// 7. Le decimos a Next.js qué rutas vigilar (Ignoramos imágenes, CSS y archivos estáticos para que la app no se vuelva lenta)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}