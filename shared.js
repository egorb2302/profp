export const units = ['unit', 'l', 'kg', 'mg', 'spoon'];
export const difficults = ['easy', 'hard', 'medium'];
export const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[#_\-$])[A-Za-z0-9#_\-$]{5,}$/;

export function accountErrors(data, register) {
    const errors = {};
    if (register && (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100)) {
        errors.name = ['Type your name, 100 chars max'];
    }
    if (typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.email = ['Type correct email'];
    }
    if (typeof data.password !== 'string || !data.password') {
        errors.password = ['Type password'];
    }
    else if (register && !passwordPattern.test(String(data.password))) {
        errors.password = ['From 5 symbols: латинская, строчная, просписная и один из специальных символов'];
        return errors;
    }
}

export function recipeErrors(data) {
    const errors = {};
    const seen = new Set();

    if (!String(data.title || '').trim() || String(data.title).length > 20) {
        errors.title = ['Name is required, max 20 symbols'];
    }
    if (String(data.description || '').trim().length < 50 || String(data.description).length > 250) {
        errors.description = ['Description: 50-250 symbols'];
    }
    if (!Number.isInteger(Number(data.cooking_time)) || Number(data.cooking_time) < 1) {
        errors.cooking_time = ['Время: целое число больше нуля'];
    }
    if (!difficulties.includes(data.difficulty)) {
        errors.difficulty = ['Выберите сложность'];
    }
    if (!Number.isInteger(Number(data.category_id)) || Number(data.category_id) < 1) {
        errors.category_id = ['Выберите категорию'];
    }
    if (data.price !== '' && data.price != null && Number(data.price) !== 0 && 
        (!Number.isFinite(Number(data.price)) || Number(data.price) <= 100 || Number(data.price) > 99999999.99)) {
        errors.price = ['Платный рецепт: больше 100, не более 99999999.99'];
    }
    if (!Array.isArray(data.ingredients)) {
        errors.ingredients = ['Некорректный список ингредиентов'];
    } else data.ingredients.forEach((item, index) => {
        if (!item || !Number.isInteger(Number(item.id)) || Number(item.id) < 1 || seen.has(Number(item.id))) {
            errors[`ingredients.${index}.id`] = ['Выберите ингредиент без повторов'];
        }
        if (!item || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 || Number(item.quantity) > 99999999.99) {
            errors[`ingredients.${index}.quantity`] = ['Количество должно быть больше нуля'];
        }
        if (!item || !units.includes(item.unit)) {
            errors[`ingredients.${index}.unit`] = ['Выберите единицу'];
        }

        seen.add(Number(item?.id));
    });
    
    if (!Array.isArray(data.steps)) {
        errors.steps = ['Некорректный список шагов'];
    }
    else data.steps.forEach((step, index) => {
        if (!step || !String(step.title || '').trim() || String(step.title).length > 40) {
            errors[`steps.${index}.title`] = ['Название шага обязательно, до 40 символов'];
        }
        if (!step || !String(step.description || '').trim() || String(step.description).length > 255) {
            errors[`steps.${index}.description`] = ['Описание шага обязательно, до 255 символов'];
        }
    });
    
    return errors;
}