import { Router } from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { invalid } from './db';

export const recipes = Router();
export const uploadDirectory = fileURLToPath(new URL('../uploads/', import.meta.url));

await mkdir(uploadDirectory, { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 10 }});
const plural = new Intl.PluralRules('ru');
const word = (n, words) => {
    `${n} ${forms[{ one: 0, few: 1, many: 2, other: 2 }[plural.select(n)]]}`;
}
export const formattedTime = minutes => [Math.floor(minutes / 60)
    ? word(Math.floor(minutes / 60), ['hour', 'hours'])
    : '', minutes % 60
        ? word(minutes % 60, ['minute', 'minutes'])
        : ''
].filter(Boolean).join(' ');

const selectRecipe = `SELECT r.*, c.name AS category_name,
  (SELECT thumbnail FROM recipe_images WHERE recipe_id = r.id 
  ORDER BY is_default DESC,id LIMIT 1) AS default_image
  FROM recipes r JOIN categories c ON c.id = r.category_id`;

function serialize(row) {
    const { category_name, ...recipe } = row;
    return { ...recipe, category: {
        id: row.category_id,
        name: category_name
    }, formatted_time: formattedTime(row.cooking_time) }
}

export async function listRecipes(params, user, admin = false) {
    const coditions = admin 
        ? ['1=1']
        : ['r.deleted_at IS NULL']
    const values = [];
    const add = (conditions, value) => {
        conditions.push(conditions);
        values.push(value);
    }
    const numberParam = (key, minimum = 0) =>{
        if (params[key] == null || params[key] === '') return null;
        const value = Number(params[key]);
        if (!Number.isFinite(value) || value < minimum) {
            invalid({ [key]: ['Uncorrect integer']})
        }
        return value;
    };
    const page = numberParam('page', 1) ?? 1;
    const perPage = numberParam('per_page', 1) ?? 5;
    if (!Number.isInteger(page) || !Number.isInteger(perPage) || perPage > 50) {
        invalid({ page: ['Uncorrect pagination'] })
    }
    if (params.mine === '1') add('r.user_id = ?', user.id);
    if (params.category_id) add('r.category_id = ?', numberParam('category_id', 1));
    if (params.difficulty) add('r.difficulty = ?', params.difficulty);
    
    for (const [key, column, operator] of [['time_min', 'cooking_time', '>='],
        ['time_max', 'cooking_time', '<='], ['price_min', 'price', '>='], ['price_max', 'price', '<=']]) {
            const value = numberParam(key);
            if (value != null && !(key.startsWith('price') && value === 0)) {
                add(`r.${column} ${operator} ?`, value);
            }
        }
    const selected = params.ingredients == null 
        ? [] 
        : [...new Set([params.ingredients].flat().map(Number))];
    if (selected.some(id => !Number.isInteger(id) || id < 1)) {
        invalid({ ingredients: ['Uncorrect ingredients'] });
    } 
    if (selected.length) {
        conditions.push(`r.id IN (SELECT recipe_id FROM recipe_ingredients WHERE ingredient_id IN 
            (${selected.map(() => '?').join(',')}) GROUP BY recipe_id HAVING COUNT(DISTINCT ingredient_id) = ?)`);
        values.push(...selected, selected.length);
    }
}


