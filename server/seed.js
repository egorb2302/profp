import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { db, query } from './db.js';
import { saveRecipe } from './recipes.js';

try {
  if (!process.env.DEMO_PASSWORD) throw new Error('Укажите DEMO_PASSWORD для учебного пользователя');
  await query('INSERT IGNORE INTO categories(name) VALUES(?)', ['Домашняя кухня']);
  for (const [title, unit] of [['Картофель', 'кг'], ['Морковь', 'шт'], ['Молоко', 'л']]) await query('INSERT IGNORE INTO ingredients(title,unit) VALUES(?,?)', [title, unit]);
  const [existing] = await query('SELECT id FROM users WHERE email=?', ['student@example.test']);
  let id = existing?.id;
  if (!id) id = (await query('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)', ['Участник', 'student@example.test', await bcrypt.hash(process.env.DEMO_PASSWORD, 10), 'user'])).insertId;
  if ((await query('SELECT id FROM recipes WHERE user_id=? LIMIT 1', [id])).length) throw new Error('Учебные рецепты уже есть; повторное наполнение пропущено');
  const [category] = await query('SELECT id FROM categories ORDER BY id LIMIT 1');
  const ingredients = await query('SELECT id,unit FROM ingredients ORDER BY id LIMIT 2');
  const image = await sharp({ create: { width: 640, height: 520, channels: 3, background: '#d9bc85' } }).png().toBuffer();
  const second = await sharp({ create: { width: 520, height: 640, channels: 3, background: '#85bcb3' } }).png().toBuffer();
  const times = [10, 15, 60, 90, 120, 150];
  for (let index = 0; index < times.length; index++) {
    await saveRecipe({ id, role: 'user' }, {
      title: `Учебный рецепт ${index + 1}`,
      description: 'Учебный рецепт для проверки каталога, сортировки и фильтров. Подготовьте продукты и следуйте указанным шагам.',
      cooking_time: times[index], difficulty: ['легко', 'средне', 'сложно'][index % 3], price: index % 2 ? 150 : 0,
      category_id: category.id,
      ingredients: ingredients.map(item => ({ id: item.id, quantity: 1, unit: item.unit })),
      steps: [{ title: 'Подготовка', description: 'Подготовьте и вымойте продукты.' }, { title: 'Приготовление', description: 'Соедините ингредиенты и приготовьте блюдо.' }]
    }, [{ originalname: 'training-1.png', buffer: image }, { originalname: 'training-2.png', buffer: second }]);
  }
  console.log('Созданы 6 учебных рецептов; изображения являются цветными учебными образцами');
} finally { await db.end(); }
