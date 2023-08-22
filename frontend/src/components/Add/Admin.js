import React, { useEffect, useState } from "react";

function AddAdmin() {
    const [user, setUser] = useState([]);

    useEffect(() => {
        fetch('http://120.126.23.245:31190/api/ldap/user/list/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(response => response.json())
        .then(data => setUser(data))
        .catch((error) => {
            console.error('Error:', error);
        }
        );
    }, []);

    let handleSubmit = async(e) => {
        if(window.confirm('Are you sure you want to add this user as an admin?')){
            e.preventDefault();
            let response = await fetch('http://120.126.23.245:31190/api/ldap/admin/add/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    "username":e.target[0].value,
                }),
            });
            if(response.status===200){
                alert('Admin added successfully');
                window.location.reload();
            } else {
                console.log('error');
            }
        }
    }





    return (
        <div>
            <h1>Add Admin</h1>
            <form onSubmit={handleSubmit}>
                <lable>Choice a User to be the OpenLDAP administer:</lable>
                <select> {user && user.map((user) => (
                    <option value={user} id={user}>{user}</option>
                ))}</select><br/>
                <input type="submit" value="Submit" />
            </form>
        </div>
    )
}

export default AddAdmin