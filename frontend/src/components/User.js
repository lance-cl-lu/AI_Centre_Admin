import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
function User() {
    let state = useLocation().state;
    let [user, setUser] = useState(null);
    useEffect(() => {
        getuserinfo();
    }, [state]);
    let getuserinfo = async () => {
        fetch('http://127.0.0.1:8000/api/ldap/user/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "username":state.user,
            }),
        })
        .then(response => response.json())
        .then(data => setUser(data))
        .catch((error) => {
            console.error('Error:', error);
        }
        );
    }
    console.log(state);
    return (
        <div>
            <h1>User</h1>
            <h2>{state && state.user}</h2>
        </div>
    )
}
export default User