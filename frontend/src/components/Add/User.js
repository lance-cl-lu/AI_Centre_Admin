import React, { useEffect, useState } from 'react'

function AddUser() {
    const [lab, setLab] = useState([]);

    useEffect(() => {
        fetch('http://120.126.23.245:31190/api/ldap/lab/list/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(response => response.json())
        .then(data => setLab(data))
        .catch((error) => {
            console.error('Error:', error);
        }
        );
    }, []);



    let handleSubmit = async(e) => {
        e.preventDefault();
        if(e.target[6].value===e.target[7].value){
            let response = await fetch('http://120.126.23.245:31190/api/ldap/user/add/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    "first_name":e.target[0].value,
                    "last_name":e.target[1].value,
                    "username":e.target[2].value,
                    "email":e.target[3].value,
                    "lab":e.target[4].value,
                    "is_lab_manager": e.target[5].checked,
                    "password":e.target[6].value,
                }),
            });
            if(response.status===200){
                alert('User added successfully');
                window.location.reload();
            } else {
                alert('User create error');
            }
        } else {
            alert('Passwords do not match');
        }
    }

    return (
        <div>
            <h1>Add User</h1>
            <form onSubmit={handleSubmit}>
                <label>First Name:   </label><input type="text" placeholder="Please enter the first name" /><br/>
                <label>Last Name:   </label><input type="text" placeholder="Please enter the last name" /><br/>
                <label>Username:   </label><input type="text" placeholder="Please enter the username" /><br/>
                <label>Email:   </label><input type="text" placeholder="Please enter the email" /><br/>
                <label>In which labatory:   </label>{lab && <select>
                    {lab.map((lab) => (
                        <option key={lab} value={lab}>
                            {lab}
                        </option>
                    ))}
                </select>}<br/>
                <label>Is Lab Manager:   <input type="checkbox"/></label><br/>
                <label>Password:   </label><input type="text" placeholder="Please enter the password" /><br/>
                <label>Confirm Password:   </label><input type="text" placeholder="Please enter the password again" /><br/>
                <button>Submit</button>
            </form>
        </div>
    )
}
export default AddUser