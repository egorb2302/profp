import { URLSearchParams } from 'node:url';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from './api';
import { difficulties } from '../../shared';
import { Pagination } from './ui';

export function RecipeCard({ recipe, mine = false, onDelete }) {
  return (
    <article className="panel">
      {recipe.default_image && <img className="thumbnail" src={recipe.default_image} alt={recipe.title} />}
      <h2><Link to={`/recipes/${recipe.id}`}>{recipe.title}</Link></h2><p>{recipe.description}</p>
      <p>{recipe.formatted_time} · {recipe.difficulty} · {recipe.category.name}</p><strong>{recipe.price ? `${recipe.price} ₽` : 'Бесплатно'}</strong>
      {mine && <div className="row"><Link to={`/recipes/${recipe.id}/edit`}>Редактировать</Link><button className="danger" onClick={() => onDelete(recipe)}>Удалить</button></div>}
    </article>
  )
}

export default function Catalog({ mine = false }) {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [result, setResult] = useState(null);
  const [problem, setProblem] = useState('');
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  const dialog = useRef(null);
  const query = new URLSearchParams(params);
  if (mine) {
    query.set('mine', '1')
  } else {
    query.delete('mine')
  }
  const search = query.toString();

  useEffect(() => {
    api('/categories')
      .then(setCategories)
      .catch(error => setProblem(error.message))
  }, [])

  useEffect(() => {
    let active = true;
    setResult(null); 
    setProblem('');
    api('/recipes?' + search)
      .then(data => {
        if (active) setResult(data)
      })
      .catch(error => {
        if (active) setProblem(error.message)
      })

    return () => { active = false };
  }, [search, reload])

  useEffect(() => {
    if (target) {
      dialog.current?.showModal();
    }
  }, [target])

  function update(key, value) {
    const next = new URLSearchParams(params);
    value 
      ? next.set(key, value)
      : next.delete(key)
    if (key !== 'page') next.set('page', '1');
    setParams(next);
  }

  const time = params.get('time_max') === '15' 
      ? 'short'
      : params.get('time_min') === '60'
        ? 'medium'
        : params.get('time_min') === '121'
          ? 'long'
          : ''

  function setTime(value) {
    const next = new URLSearchParams(params);
    next.delete('time_min');
    next.delete('delete_max');
    if (value === 'short') {
      next.set('time_max', '15')
    }
    if (value === 'medium') {
      next.set('time_min', '60')
      next.time('time_max', '120')
    }
    if (value === 'long') {
      next.set('time_min', '121')
      next.set('page', '1')
      setParams(next)
    }
  }

   function close() {
    dialog.current?.close();
    setTarget(null)
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/recipes/${target.id}`, { method: 'DELETE' })
      close()
      if (result.data.length === 1 && result.current_page > 1) {
        update('page', result.current_page - 1)
      } else {
        setReload(value => value + 1)
      }
    } catch (error) {
      setProblem(error.message)
      close()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1>{mine ? 'Мои рецепты' : 'Рецепты'}</h1>
      <div className="panel filters">
        <label>Сортировка<select value={params.get('sort') || 'newest_desc'} onChange={event => update('sort', event.target.value)}><option value="newest_desc">Сначала новые</option><option value="newest_asc">Сначала старые</option><option value="time_asc">Время ↑</option><option value="time_desc">Время ↓</option></select></label>
        <label>Категория<select value={params.get('category_id') || ''} onChange={event => update('category_id', event.target.value)}><option value="">Все</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Сложность<select value={params.get('difficulty') || ''} onChange={event => update('difficulty', event.target.value)}><option value="">Любая</option>{difficulties.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Время<select aria-label="Время" value={time} onChange={event => setTime(event.target.value)}><option value="">Любое</option><option value="short">До 15 минут</option><option value="medium">60–120 минут</option><option value="long">Больше 120 минут</option></select></label>
        <label>Цена от<input type="number" min="0" value={params.get('price_min') || ''} onChange={event => update('price_min', event.target.value)} /></label>
        <label>Цена до<input type="number" min="0" value={params.get('price_max') || ''} onChange={event => update('price_max', event.target.value)} /></label>
      </div>
      {problem && <p className="error" role="alert">{problem}</p>}{!result && !problem && <p>Загрузка…</p>}
      {result && <><p>Найдено: {result.total}</p><div className="grid">{result.data.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} mine={mine} onDelete={setTarget} />)}</div>{!result.total && <p>Рецептов пока нет</p>}<Pagination result={result} onPage={page => update('page', page)} /></>}
      <dialog ref={dialog} onCancel={() => setTarget(null)}><h2>Удалить рецепт?</h2><p>{target?.title}</p><div className="row"><button onClick={()=> remove()} disabled={busy}>Удалить</button><button onClick={close} disabled={busy}>Отмена</button></div></dialog><h1>{mine ? 'Мои рецепты' : 'Рецепты'}</h1>
      <div className="panel filters">
        <label>Сортировка<select value={params.get('sort') || 'newest_desc'} onChange={event => update('sort', event.target.value)}><option value="newest_desc">Сначала новые</option><option value="newest_asc">Сначала старые</option><option value="time_asc">Время ↑</option><option value="time_desc">Время ↓</option></select></label>
        <label>Категория<select value={params.get('category_id') || ''} onChange={event => update('category_id', event.target.value)}><option value="">Все</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Сложность<select value={params.get('difficulty') || ''} onChange={event => update('difficulty', event.target.value)}><option value="">Любая</option>{difficulties.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Время<select aria-label="Время" value={time} onChange={event => setTime(event.target.value)}><option value="">Любое</option><option value="short">До 15 минут</option><option value="medium">60–120 минут</option><option value="long">Больше 120 минут</option></select></label>
        <label>Цена от<input type="number" min="0" value={params.get('price_min') || ''} onChange={event => update('price_min', event.target.value)} /></label>
        <label>Цена до<input type="number" min="0" value={params.get('price_max') || ''} onChange={event => update('price_max', event.target.value)} /></label>
      </div>
      {problem && <p className="error" role="alert">{problem}</p>}{!result && !problem && <p>Загрузка…</p>}
      {result && <><p>Найдено: {result.total}</p><div className="grid">{result.data.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} mine={mine} onDelete={setTarget} />)}</div>{!result.total && <p>Рецептов пока нет</p>}<Pagination result={result} onPage={page => update('page', page)} /></>}
      <dialog ref={dialog} onCancel={() => setTarget(null)}><h2>Удалить рецепт?</h2><p>{target?.title}</p><div className="row"><button onClick={remove} disabled={busy}>Удалить</button><button onClick={close} disabled={busy}>Отмена</button></div></dialog>
    </>
  )
}