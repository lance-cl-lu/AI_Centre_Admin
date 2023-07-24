import React, { useState, useEffect, useContext} from 'react'
import { useLocation } from 'react-router-dom'
import AuthContext from '../context/AuthContext';
import "./User.css";

function User() {
    let state = useLocation().state;
    let [user, setUser] = useState(null);
    let {setinfolistChecker} = useContext(AuthContext);

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
        .then(data => {setUser(data);})
        .catch((error) => {
            console.error('Error:', error);
        }
        );
    }

    const deleteUser = async () => {
        if(!window.confirm("Are you sure you want to delete this user?")) return;
        let response = await fetch('http://127.0.0.1:8000/api/ldap/user/delete/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "username":state.user,
            }),
        })
        if(response.status===200){
            alert('User deleted successfully');
            setinfolistChecker = false;
        }
        else {
            console.log('error');
        }
    }

    return (
        <div className='userPage'>
            <h1>User {state && state.user}</h1>
            {user  && <button type="button" class="btn btn-danger" onClick={deleteUser}>Delete</button> }
            <div class="row g-3">
                <div class="col-md-6">
                    {user && <input type="text" class="form-control" placeholder="First name" aria-label="First name" value={user.first_name} readOnly/>}
                </div>
                <div class="col-md-6">
                    {user && <input type="text" class="form-control" placeholder="Last name" aria-label="Last name" value={user.last_name} readOnly/>}
                </div>
                <div class="col-12">
                    {user && <input type="text" class="form-control" placeholder="Email" aria-label="Email" value={user.email} readOnly/>}
                </div>
                <div class="col-12">
                    {user && <input type="text" class="form-control" placeholder="Username" aria-label="Username" value={user.username} readOnly/>}
                </div>
            </div>
        </div>
    )
}
export default User