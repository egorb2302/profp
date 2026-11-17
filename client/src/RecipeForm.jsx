import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from './api';
import { useAuth } from './App.jsx'
import { Field } from './ui';
import { difficulties, recipeErrors, units } from '../../shared.js';

const empty = {
  title: '',
  description: '',
  cooking_time: '',
  difficulty: 'easy',
  price: '',
  category_id: '',
  ingredients: [],
  steps: [{
    title: '',
    description: ''
  }]
}

export default function ReciipeForm() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(empty);
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [oldImages, setOldImages] = useState([]);
  const [removed, setRemoved] = useState('');
  const [files, setFiles] = useState([]);
  const [defaultImage, setDefaultImage] = useState('');
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true)
    setProblem('')
    Promise.all([api('/categories'), api('/ingredients'), id
      ? api('/recipes/' + id)
      : Promise.resolve(null)
    ]).then(([categories, ingredients, recipe]) => {
      if (!active) return;
      setCategories(categories)
      setIngredients(ingredients)
      setFiles([])
      setRemoved([])
      setErrors({})
      setForbidden(false)
      if (recipe && recipe.user_id !== user.id) {
        setForbidden(true)
        return
      }
      setData(recipe 
        ? { ...recipe, price: recipe.price || '' }
        : { ...empty, category_id: categories[0]?.id || '' }
      )
      setOldImages(recipe?.image || [])
      setDefaultImage(recipe 
        ? `old:${recipe.images.find(image => {
          image.is_default
        })?.id || recipe.images[0]?.id}`
        : 'new:0')
    })
    .catch(error => { 
      if (active) {
        setProblem(error.message)
      }
    })
    .finally(() => {
      if (active) {
        setLoading(false)
      }
    })

    return () => { active = false }
  }, [id, user.id])

  const set = (key, value) => setData(previous => ({ ...previous, [key]: value }))
  const input = key => ({ value: data[key], onChange: event => set(key, event.target.value)})
  function updateItem(group, index, key, value) {
    setData(previous => ({ ...previous, [group]: previous[group].map((item, i) => {
      i === index
        ? { ...item, [key]: value }
        : item
    })}))
  }
  const removeItem = (group, index) => {
    setData(previous => ({ ...previous, [group]: previous[group].filter((_, i) => i !== index) }))
  }
  async function submit(event) {
    event.preventDefault()
    setProblem('')
    const errors = recipeErrors(data);
    if (oldImages.length - removed.length + files.length < 2) errors.images = ['Нужно минимум два изображения'];
    if (files.some(file => file.size > 2 * 1024 * 1024 || !/\.(jpe?g|png|webp)$/i.test(file.name))) errors.images = ['JPG/PNG/WebP, каждый файл до 2 МБ'];
    setErrors(errors);
    if (Object.keys(errors).length) return;
    const body = new FormData();
    for (const key of ['title', 'description', 'cooking_time', 'difficulty', 'price', 'category_id']) body.append(key, data[key]);
    body.append('ingredients', JSON.stringify(data.ingredients)); body.append('steps', JSON.stringify(data.steps));
    body.append('remove_image_ids', JSON.stringify(removed)); body.append('default_image', defaultImage);
    files.forEach(file => body.append('images[]', file));
    setBusy(true);
    try {
      const recipe = await api(id ? '/recipes/' + id : '/recipes', { method: id ? 'PATCH' : 'POST', body });
      navigate('/recipes/' + recipe.id);
    } catch (error) { setErrors(error.errors || {}); setProblem(error.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <form className="panel" onSubmit={submit} noValidate>
        <h1>{id ? 'Редактирование' : 'Новый рецепт'}</h1>
        <Field name="title" label="Название, до 20 символов" errors={errors}><input {...input('title')} maxLength={20} /></Field>
        <Field name="description" label="Описание, 50–250 символов" errors={errors}><textarea {...input('description')} maxLength={250} /></Field>
        <Field name="cooking_time" label="Время, минуты" errors={errors}><input type="number" min="1" {...input('cooking_time')} /></Field>
        <Field name="difficulty" label="Сложность" errors={errors}><select {...input('difficulty')}>{difficulties.map(value => <option key={value}>{value}</option>)}</select></Field>
        <Field name="price" label="Цена, больше 100 ₽; оставьте пустой для бесплатного" errors={errors}><input type="number" min="0" step="0.01" {...input('price')} /></Field>
        <Field name="category_id" label="Категория" errors={errors}><select {...input('category_id')}><option value="">Выберите</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <fieldset className={errors.images ? 'has-error' : ''}><legend>Изображения: минимум два, от 500×500</legend>
          {oldImages.map(image => <div className="row" key={image.id}><img width="100" src={image.thumbnail} alt="Фото рецепта" /><label><input type="checkbox" checked={removed.includes(image.id)} onChange={event => setRemoved(event.target.checked ? [...removed, image.id] : removed.filter(id => id !== image.id))} />Удалить</label>{!removed.includes(image.id) && <label><input className="form-check-input" type="radio" name="default_image" checked={defaultImage === `old:${image.id}`} onChange={() => setDefaultImage(`old:${image.id}`)} />Основное</label>}</div>)}
          <input aria-label="Новые изображения" type="file" accept=".jpg,.jpeg,.png,.webp" multiple onChange={event => setFiles([...event.target.files])} />
          {files.map((file, index) => <label key={index}><input className="form-check-input" type="radio" name="default_image" checked={defaultImage === `new:${index}`} onChange={() => setDefaultImage(`new:${index}`)} />Основное: {file.name}</label>)}
          <small className="error">{errors.images?.[0]}</small>
        </fieldset>
        <h2>Ингредиенты</h2><p className="error">{errors.ingredients?.[0]}</p>
        {data.ingredients.map((item, index) => <fieldset key={index}><legend>Ингредиент {index + 1}</legend>
          <Field name={`ingredients.${index}.id`} label="Ингредиент" errors={errors}><select value={item.id} onChange={event => updateItem('ingredients', index, 'id', event.target.value)}><option value="">Выберите</option>{ingredients.map(value => <option key={value.id} value={value.id}>{value.title}</option>)}</select></Field>
          <Field name={`ingredients.${index}.quantity`} label="Количество" errors={errors}><input type="number" step="0.01" min="0.01" value={item.quantity} onChange={event => updateItem('ingredients', index, 'quantity', event.target.value)} /></Field>
          <Field name={`ingredients.${index}.unit`} label="Единица" errors={errors}><select value={item.unit} onChange={event => updateItem('ingredients', index, 'unit', event.target.value)}>{units.map(value => <option key={value}>{value}</option>)}</select></Field>
          <button type="button" onClick={() => removeItem('ingredients', index)}>Убрать ингредиент</button>
        </fieldset>)}
        <button type="button" onClick={() => set('ingredients', [...data.ingredients, { id: '', quantity: 1, unit: 'шт' }])}>Добавить ингредиент</button>
        <h2>Шаги</h2><p className="error">{errors.steps?.[0]}</p>
        {data.steps.map((step, index) => <fieldset key={index}><legend>Шаг {index + 1}</legend>
          <Field name={`steps.${index}.title`} label="Название шага, до 40 символов" errors={errors}><input value={step.title} maxLength={40} onChange={event => updateItem('steps', index, 'title', event.target.value)} /></Field>
          <Field name={`steps.${index}.description`} label="Описание шага, до 255 символов" errors={errors}><textarea value={step.description} maxLength={255} onChange={event => updateItem('steps', index, 'description', event.target.value)} /></Field>
          <button type="button" onClick={() => removeItem('steps', index)}>Убрать шаг</button>
        </fieldset>)}
        <button type="button" onClick={() => set('steps', [...data.steps, { title: '', description: '' }])}>Добавить шаг</button>
        <p className="error" role="alert">{problem}</p><button disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить рецепт'}</button>
      </form>;
    </>
  )
}