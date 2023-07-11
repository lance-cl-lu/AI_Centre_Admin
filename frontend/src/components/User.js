import React from 'react'
import { Link, useLocation } from 'react-router-dom'
function User() {
    let state = useLocation().state;
    console.log(state);
    return (
        <div>
            <h1>User</h1>
            <h2>{state && state.user}</h2>
        </div>
    )
}
export default User