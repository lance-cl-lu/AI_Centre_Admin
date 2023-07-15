import React from 'react'
import { useLocation } from 'react-router-dom';

function AddUser() {

    let handleSubmit = async(e) => {
        e.preventDefault();
        if(e.target[6].value===e.target[7].value){
            let response = await fetch('http://127.0.0.1:8000/api/ldap/user/add/', {
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
                    "is_lab_manager":e.target[5].value,
                    "password":e.target[6].value,
                }),
            });
            let data = await response.json();
            if(response.status===200){
                console.log(data);
                alert('User added successfully');
            } else {
                console.log('error');
            }
        } else {
            alert('Passwords do not match');
        }
    }
    const location = useLocation();
    console.log(location);

    return (
        <div>
            <h1>Add User</h1>
            <form onSubmit={handleSubmit}>
                <label>First Name:   </label><input type="text" placeholder="Please enter the first name" /><br/>
                <label>Last Name:   </label><input type="text" placeholder="Please enter the last name" /><br/>
                <label>Username:   </label><input type="text" placeholder="Please enter the username" /><br/>
                <label>Email:   </label><input type="text" placeholder="Please enter the email" /><br/>
                <label>In which labatory:   </label><select>
                    <option value="lab1">Lab 1</option>
                    <option value="lab2">Lab 2</option>
                    <option value="lab3">Lab 3</option>
                    <option value="lab4">Lab 4</option>
                </select><br/>
                <label>Is Lab Manager:   <input type="checkbox"/></label><br/>
                <label>Password:   </label><input type="text" placeholder="Please enter the password" /><br/>
                <label>Confirm Password:   </label><input type="text" placeholder="Please enter the password again" /><br/>
                <button>Submit</button>
            </form>
        </div>
    )
}
export default AddUser