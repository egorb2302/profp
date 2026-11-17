import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, query, fail, invalid } from './db.js';
import { recipeErrors } from '../shared.js';

export const recipes = Router();
export const uploadsDirectory = fileURLToPath(new URL('../uploads/', import.meta.url));
await mkdir(uploadsDirectory, { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 10 } });
const plural = new Intl.PluralRules('ru');
const word = (n, forms) => `${n} ${forms[{ one: 0, few: 1, many: 2, other: 2 }[plural.select(n)]]}`;
export const formattedTime = minutes => [Math.floor(minutes / 60) ? word(Math.floor(minutes / 60), ['час', 'часа', 'часов']) : '', minutes % 60 ? word(minutes % 60, ['минута', 'минуты', 'минут']) : ''].filter(Boolean).join(' ');

const selectRecipe = `SELECT r.*, c.name AS category_name,
  (SELECT thumbnail FROM recipe_images WHERE recipe_id = r.id ORDER BY is_default DESC,id LIMIT 1) AS default_image
  FROM recipes r JOIN categories c ON c.id = r.category_id`;

function serialize(row) {
  const { category_name, ...recipe } = row;
  return { ...recipe, category: { id: row.category_id, name: category_name }, formatted_time: formattedTime(row.cooking_time) };
}

export async function listRecipes(params, user, admin = false) {
  const conditions = admin ? ['1=1'] : ['r.deleted_at IS NULL'];
  const values = [];
  const add = (condition, value) => { conditions.push(condition); values.push(value); };
  const numberParam = (key, minimum = 0) => {
    if (params[key] == null || params[key] === '') return null;
    const value = Number(params[key]);
    if (!Number.isFinite(value) || value < minimum) invalid({ [key]: ['Некорректное число'] });
    return value;
  };
  const page = numberParam('page', 1) ?? 1;
  const perPage = numberParam('per_page', 1) ?? 5;
  if (!Number.isInteger(page) || !Number.isInteger(perPage) || perPage > 50) invalid({ page: ['Некорректная пагинация'] });
  if (params.mine === '1') add('r.user_id = ?', user.id);
  if (params.category_id) add('r.category_id = ?', numberParam('category_id', 1));
  if (params.difficulty) add('r.difficulty = ?', params.difficulty);
  for (const [key, column, operator] of [['time_min', 'cooking_time', '>='], ['time_max', 'cooking_time', '<='], ['price_min', 'price', '>='], ['price_max', 'price', '<=']]) {
    const value = numberParam(key);
    if (value != null && !(key.startsWith('price') && value === 0)) add(`r.${column} ${operator} ?`, value);
  }
  const selected = params.ingredients == null ? [] : [...new Set([params.ingredients].flat().map(Number))];
  if (selected.some(id => !Number.isInteger(id) || id < 1)) invalid({ ingredients: ['Некорректные ингредиенты'] });
  if (selected.length) {
    conditions.push(`r.id IN (SELECT recipe_id FROM recipe_ingredients WHERE ingredient_id IN (${selected.map(() => '?').join(',')}) GROUP BY recipe_id HAVING COUNT(DISTINCT ingredient_id) = ?)`);
    values.push(...selected, selected.length);
  }
  const sorts = { newest_desc: 'r.created_at DESC,r.id DESC', newest_asc: 'r.created_at ASC,r.id ASC', time_asc: 'r.cooking_time ASC,r.id ASC', time_desc: 'r.cooking_time DESC,r.id DESC' };
  const sort = params.sort || 'newest_desc';
  if (!Object.hasOwn(sorts, sort)) invalid({ sort: ['Неизвестная сортировка'] });
  const where = ` WHERE ${conditions.join(' AND ')}`;
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM recipes r' + where, values);
  const rows = await query(selectRecipe + where + ` ORDER BY ${sorts[sort]} LIMIT ? OFFSET ?`, [...values, perPage, (page - 1) * perPage]);
  return { data: rows.map(serialize), current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getRecipe(id, includeDeleted = false) {
  const [row] = await query(selectRecipe + ' WHERE r.id = ?' + (includeDeleted ? '' : ' AND r.deleted_at IS NULL'), [id]);
  if (!row) fail(404, 'Recipe not found');
  const images = await query('SELECT * FROM recipe_images WHERE recipe_id = ? ORDER BY id', [id]);
  const ingredients = await query('SELECT i.id,i.title,ri.quantity,ri.unit FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id WHERE recipe_id = ?', [id]);
  const steps = await query('SELECT id,title,description,position AS `order` FROM steps WHERE recipe_id = ? ORDER BY position', [id]);
  return { ...serialize(row), images: images.map(image => ({ ...image, is_default: Boolean(image.is_default) })), ingredients, steps };
}

function arrayField(value, field) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { invalid({ [field]: ['Ожидается массив'] }); }
}

export async function removeFiles(images) {
  await Promise.all(images.flatMap(image => [image.path, image.thumbnail]).map(file => unlink(path.join(uploadsDirectory, path.basename(file))).catch(() => {})));
}

export async function saveRecipe(user, body, files, id) {
  const previous = id ? await getRecipe(id) : null;
  if (previous && previous.user_id !== user.id && user.role !== 'admin') fail(403, 'Forbidden for you');
  const ingredients = arrayField(body.ingredients || [], 'ingredients');
  const steps = arrayField(body.steps || [], 'steps');
  const removedIds = arrayField(body.remove_image_ids || [], 'images').map(Number);
  if (removedIds.some(imageId => !previous?.images.some(image => image.id === imageId))) invalid({ images: ['Изображение не принадлежит рецепту'] });
  const kept = previous?.images.filter(image => !removedIds.includes(image.id)) || [];
  const errors = recipeErrors({ ...body, ingredients, steps });
  if (kept.length + files.length < 2) errors.images = ['Необходимо минимум два изображения'];
  if (!(await query('SELECT id FROM categories WHERE id = ?', [Number(body.category_id) || 0])).length) errors.category_id = ['Категория не найдена'];
  const available = new Set((await query('SELECT id FROM ingredients')).map(item => item.id));
  ingredients.forEach((item, index) => { if (!available.has(Number(item?.id))) errors[`ingredients.${index}.id`] = ['Ингредиент не найден']; });
  const formats = [];
  for (const file of files) {
    try {
      const metadata = await sharp(file.buffer).metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format) || !/\.(jpe?g|png|webp)$/i.test(file.originalname) || metadata.width < 500 || metadata.height < 500) throw new Error();
      formats.push(metadata.format);
    } catch { errors.images = ['Нужны JPG/PNG/WebP минимум 500×500, до 2 МБ']; }
  }
  invalid(errors);
  const newImages = [];
  const connection = await db.getConnection();
  try {
    for (const [index, file] of files.entries()) {
      const filename = randomUUID();
      const image = { path: `/uploads/${filename}.${formats[index]}`, thumbnail: `/uploads/${filename}.webp` };
      if (formats[index] === 'webp') image.path = `/uploads/${filename}-original.webp`;
      newImages.push(image);
      await writeFile(path.join(uploadsDirectory, path.basename(image.path)), file.buffer);
      await sharp(file.buffer).rotate().resize(350, 200, { fit: 'contain', background: 'white' }).webp().toFile(path.join(uploadsDirectory, path.basename(image.thumbnail)));
    }
    await connection.beginTransaction();
    const values = [body.title.trim(), body.description.trim(), Number(body.cooking_time), body.difficulty, Number(body.price || 0), Number(body.category_id)];
    if (id) await query('UPDATE recipes SET title=?,description=?,cooking_time=?,difficulty=?,price=?,category_id=? WHERE id=?', [...values, id], connection);
    else {
      const result = await query('INSERT INTO recipes(title,description,cooking_time,difficulty,price,category_id,user_id) VALUES(?,?,?,?,?,?,?)', [...values, user.id], connection);
      id = result.insertId;
    }
    if (removedIds.length) await query('DELETE FROM recipe_images WHERE recipe_id=? AND id IN (?)', [id, removedIds], connection);
    for (const image of newImages) {
      const result = await query('INSERT INTO recipe_images(recipe_id,path,thumbnail) VALUES(?,?,?)', [id, image.path, image.thumbnail], connection);
      image.id = result.insertId;
    }
    const allImages = [...kept, ...newImages];
    let defaultId = allImages[0].id;
    if (body.default_image?.startsWith('old:')) defaultId = kept.find(image => image.id === Number(body.default_image.slice(4)))?.id || defaultId;
    if (body.default_image?.startsWith('new:')) defaultId = newImages[Number(body.default_image.slice(4))]?.id || defaultId;
    await query('UPDATE recipe_images SET is_default=(id=?) WHERE recipe_id=?', [defaultId, id], connection);
    await query('DELETE FROM recipe_ingredients WHERE recipe_id=?', [id], connection);
    for (const item of ingredients) await query('INSERT INTO recipe_ingredients(recipe_id,ingredient_id,quantity,unit) VALUES(?,?,?,?)', [id, Number(item.id), Number(item.quantity), item.unit], connection);
    await query('DELETE FROM steps WHERE recipe_id=?', [id], connection);
    for (const [index, step] of steps.entries()) await query('INSERT INTO steps(recipe_id,title,description,position) VALUES(?,?,?,?)', [id, step.title.trim(), step.description.trim(), index + 1], connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    await removeFiles(newImages);
    throw error;
  } finally { connection.release(); }
  await removeFiles(previous?.images.filter(image => removedIds.includes(image.id)) || []);
  return getRecipe(id);
}

recipes.get('/', async (req, res) => res.json(await listRecipes(req.query, req.user)));
recipes.get('/:id', async (req, res) => res.json(await getRecipe(req.params.id)));
recipes.post('/', upload.array('images[]'), async (req, res) => res.status(201).json(await saveRecipe(req.user, req.body, req.files || [])));
recipes.patch('/:id', upload.array('images[]'), async (req, res) => res.json(await saveRecipe(req.user, req.body, req.files || [], req.params.id)));
recipes.put('/:id', upload.array('images[]'), async (req, res) => res.json(await saveRecipe(req.user, req.body, req.files || [], req.params.id)));
recipes.delete('/:id', async (req, res) => {
  const recipe = await getRecipe(req.params.id);
  if (recipe.user_id !== req.user.id) fail(403, 'Forbidden for you');
  await query('UPDATE recipes SET deleted_at=NOW() WHERE id=?', [recipe.id]);
  res.json({ success: true });
});


