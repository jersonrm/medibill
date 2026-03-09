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
  const isOnboardingPage = request.nextUrl.pathname.startsWith('/onboarding')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')
  const isAuthCallback = request.nextUrl.pathname.startsWith('/api/auth')
  const isBillingPage = request.nextUrl.pathname.startsWith('/configuracion/suscripcion')
  const isInvitacionPage = request.nextUrl.pathname.startsWith('/invitacion')
  const isAdminPage = request.nextUrl.pathname.startsWith('/admin')

  // 4. REGLA A: Si NO hay usuario y quiere entrar a cualquier lado que no sea el login o invitación, lo pateamos al login.
  if (!user && !isLoginPage && !isInvitacionPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 4.5 REGLA A2: Si hay usuario pero NO confirmó su email, cerrar sesión y redirigir al login.
  if (user && !isLoginPage && !isAuthCallback) {
    const emailConfirmed = user.email_confirmed_at != null
    if (!emailConfirmed) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('mensaje', 'email_no_confirmado')
      return NextResponse.redirect(url)
    }
  }

  // 5. REGLA B: Si SÍ hay usuario, y por error intenta ir a /login, lo redirigimos al dashboard.
  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // 6. REGLA C: Verificar onboarding — solo para rutas de app (no API, no onboarding, no login, no admin)
  if (user && !isLoginPage && !isOnboardingPage && !isApiRoute && !isAdminPage) {
    // Usar cookie para cachear el estado de onboarding y evitar query en cada request
    const onboardingCookie = request.cookies.get('medibill_onboarding')
    if (onboardingCookie?.value !== 'complete') {
      // Verificar en Supabase si el perfil tiene onboarding completo
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('onboarding_completo')
        .eq('user_id', user.id)
        .single()

      if (!perfil || perfil.onboarding_completo !== true) {
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }

      // Cachear en cookie de sesión (se borra al cerrar el navegador)
      supabaseResponse.cookies.set('medibill_onboarding', 'complete', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        // Sin maxAge ni expires: cookie de sesión que se elimina al cerrar el navegador
      })
    }
  }

  // 6.3 REGLA C2: Proteger rutas /admin/* — solo platform_admins
  if (user && isAdminPage) {
    const adminCookie = request.cookies.get('medibill_is_platform_admin')
    if (adminCookie?.value !== 'true') {
      const { data: adminRow } = await supabase
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .single()

      if (!adminRow) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }

      supabaseResponse.cookies.set('medibill_is_platform_admin', 'true', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 300, // Re-check cada 5 minutos
      })
    }
  }

  // 6.5 REGLA D: Verificar suscripción activa — redirigir a billing si cancelada/expirada
  if (user && !isLoginPage && !isOnboardingPage && !isApiRoute && !isBillingPage && !isInvitacionPage && !isAdminPage) {
    const subCookie = request.cookies.get('medibill_sub_status')
    const subStatus = subCookie?.value

    if (!subStatus || subStatus === 'unknown') {
      // Consultar estado de suscripción
      const { data: membership } = await supabase
        .from('usuarios_organizacion')
        .select('organizacion_id')
        .eq('user_id', user.id)
        .eq('activo', true)
        .limit(1)
        .single()

      if (membership) {
        const { data: sub } = await supabase
          .from('suscripciones')
          .select('estado, fin_periodo_actual')
          .eq('organizacion_id', membership.organizacion_id)
          .single()

        const estado = sub?.estado || 'none'
        supabaseResponse.cookies.set('medibill_sub_status', estado, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 300, // Re-check cada 5 minutos
        })

        if (estado === 'canceled' || estado === 'unpaid') {
          const url = request.nextUrl.clone()
          url.pathname = '/configuracion/suscripcion'
          return NextResponse.redirect(url)
        }
      }
    } else if (subStatus === 'canceled' || subStatus === 'unpaid') {
      const url = request.nextUrl.clone()
      url.pathname = '/configuracion/suscripcion'
      return NextResponse.redirect(url)
    }
  }

  // 7. Si todo está en orden, lo dejamos pasar.
  return supabaseResponse
}

// 7. Le decimos a Next.js qué rutas vigilar (Ignoramos imágenes, CSS y archivos estáticos para que la app no se vuelva lenta)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}