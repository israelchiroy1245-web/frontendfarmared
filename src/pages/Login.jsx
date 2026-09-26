import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { login } from '@/lib/auth'

export default function Login() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!usuario.trim() || !password) {
      toast.error('Ingresa usuario y contraseña')
      return
    }

    setLoading(true)
    try {
      await login({ usuario: usuario.trim(), password })
      toast.success('Sesión iniciada')
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(err.message || 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-[radial-gradient(ellipse_at_top,_#1a4d44_0%,_#0f241f_55%,_#0a1a16_100%)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#c8e6c0] text-[#12352f]">
            <Activity className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl text-white">FarmaRed</h1>
          <p className="mt-2 text-sm text-white/60">Acceso al control operativo</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-sm"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="usuario" className="text-xs font-medium text-white/70">
                Correo
              </label>
              <input
                id="usuario"
                name="usuario"
                type="email"
                autoComplete="username"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="h-10 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#c8e6c0]/60 focus:ring-2 focus:ring-[#c8e6c0]/25"
                placeholder="admin@farmared.gt"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-white/70">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#c8e6c0]/60 focus:ring-2 focus:ring-[#c8e6c0]/25"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-6 h-10 w-full bg-[#c8e6c0] text-[#12352f] hover:bg-[#d4edce]"
          >
            {loading ? 'Entrando…' : 'Iniciar sesión'}
          </Button>
        </form>
      </div>
    </div>
  )
}
