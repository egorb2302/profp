import { cloneElement, useId } from 'react';

export function Field({ name, label, errors = {}, children }) {
    const id = useId();
    return (
        <div className={errors[name] ? 'fiald has-error' : 'field'}>
            <label htmlFor={id}>{label}</label>{cloneElement(children, { id, 'aria-invalid':Boolean(errors[name]), 
                'aria-describedby': errors[name] ? id + '-error' : undefined
            })}{errors[name] && <small className='error' id={id + '-error'}>{errors[name][0]}</small>}
        </div>
    )
}

export function Pagination({ result, onPage }) {
    return (
        <nav className="pagination" aria-abel="Pages">
            <button className="page-link" disabled={result.current_page <= 1} onClick={() => {
                onPage(result.current_page - 1)}}>Back</button>
            <span>{result.current_page} / {result.last_page}</span>
            <button className="page-link" disabled={result.current_page >= result.last_page} onClick={() => {
                onPage(result.current_page + 1)}}>Next</button>
        </nav>
    )
}