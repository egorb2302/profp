import { createContext, useContext, useState, useEffect } from "react";
import { Link, Navigate, Outlet, useNavigate, Route, Routes } from "react-router-dom";
import { accountErrors } from "../shared";
import { Field } from './src/ui';
import { api } from './src/api';
import Catalog from './src/Catalog.jsx';
import RecipeForm from './src/RecipeForm.jsx';
import RecipeDetail from './src/RecipeDetail.jsx';
import Constructor from './src/Constructor.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function Protected() {
    const { token, user, loading, problem, refresh } = useAuth();
    if (!token) return <Navigate to="/login" replace />
    if (problem) return <section><p className="error">{problem}</p>
        <button onClick={refresh}>Repeat</button></section>
    if (loading || !user) return <p role="status">Loading...</p>;
    return <Outlet />
}

function AccountForm({ register = false }) {
    const { setToken } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState({ name: '', email: '', password: ''});
    const [errors, setErrors] = useState({});
    const [problem, setProblem] = useState('');
    const [busy, setBusy] = useState(false);
    const field = name => (
        { value: data[name], onChange: event => setData({ ...data, [name]: event.target.value })}
    )
    async function submit(event) {
        event.preventDefault();
        const errors = accountErrors(data, register);
        setErrors(errors); setProblem('');
        if (Object.keys(errors).length) return;
        setBusy(true);
        try {
            const response = await api(register 
                ? '/register' 
                : '/auth', { method: 'POST', body: data

                })
            if (!register) setToken(response.token);
            navigate(register ? '/login' : '/')
        } catch (error) {
            setErrors(!register && error.message === 'Invalid credentials' 
                ? { email: ['Check email and password'], password: ['Check email and password']}
                : error.errors || {})
            setProblem(error.message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <form className="panel" onSubmit={submit} noValidate>
            <h1>{register ? 'Регистрация' : 'Вход'}</h1>
            {register && <Field name="name" label="Имя" errors={errors}><input autoComplete="name" {...field('name')} /></Field>}
            <Field name="email" label="Email" errors={errors}><input type="email" autoComplete="email" {...field('email')} /></Field>
            <Field name="password" label="Пароль" errors={errors}><input type="password" autoComplete={register ? 'new-password' : 'current-password'} {...field('password')} /></Field>
            <p className="error" role="alert">{problem}</p><button disabled={busy}>{register ? 'Зарегистрироваться' : 'Войти'}</button>
            <p><Link to={register ? '/login' : '/register'}>{register ? 'Уже есть аккаунт' : 'Создать аккаунт'}</Link></p>
        </form>
    )
}

export default function App() {
    const [token, changeToken] = useState(() => localStorage.getItem('token') || '');
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(Boolean(token));
    const [problem, setProblem] = useState('');
    const [reload, setReload] = useState(0);

    function setToken(value) {
        value 
            ? localStorage.setItem('token', value)
            : localStorage.removeItem('token')
        setUser(null); 
        changeToken(value);
    }

    useEffect(() => {
        let active = true;
        if (!token) {
            setUser(null);
            setLoading(false);
            setProblem('');
            return
        }
        setLoading(true);
        setProblem('');
        api('/me').then(user => {
            if (active) {
                setUser(user)
            }
        }).catch(error => {
            if (!active) return;
            if (error.status === 401 || error.status === 403) {
                setToken('');
            } else {
                setProblem('Cant connect to the server')
            }
        }).finally(() => {
            if (active) {
                setLoading(false)
            }
        })
        return () => {
            active = false
        }
    }, [token, reload])

    async function logout() {
        try {
            await api('/logout', { method: 'POST' })
        } catch (error) {
            console.log(error)
        } finally {
            setToken('');
        }
    }

    return (
        <AuthContext.Provider value={{ token, user, loading, problem, setToken, refresh: () => setReload(value => value + 1) }}>
            <main><nav><Link to="/">Кухни мира</Link>
                {token && <><Link to="/my-recipes">Мои рецепты</Link><Link to="/recipes/create">Добавить рецепт</Link>
                    <Link to="/constructor">По ингредиентам</Link><button onClick={logout}>Выйти</button></>}</nav>
                <Routes>
                    <Route path="/login" element={<AccountForm key="login" />} /><Route path="/register" element={<AccountForm key="register" register />} />
                        <Route element={<Protected />}>
                        <Route path="/" element={<Catalog key="all" />} /><Route path="/my-recipes" element={<Catalog key="mine" mine />} />
                        <Route path="/recipes/create" element={<RecipeForm key="create" />} /><Route path="/recipes/:id/edit" element={<RecipeForm key="edit" />} />
                        <Route path="/recipes/:id" element={<RecipeDetail />} /><Route path="/constructor" element={<Constructor />} />
                    </Route>
                    <Route path="*" element={<p>Страница не найдена</p>} />
                </Routes>
            </main>
        </AuthContext.Provider>
    )
}