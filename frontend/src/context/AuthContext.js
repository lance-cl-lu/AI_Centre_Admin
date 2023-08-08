import { createContext, useState } from "react";
import jwt_decode from "jwt-decode";

const AuthContext = createContext();

export default AuthContext;

export const AuthProvider = ({ children }) => {

    const [user, setUser] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken')) : null)

    const [userlist, setUesrlist] = useState(null)

    let getUserList = async ( ) => {
        let response = await fetch('http://127.0.0.1:8000/api/ldap/info/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({'user': user.username}),
        });
        let data = await response.json();
        if(response.status===200){
            setUesrlist(data);
        } else {
            console.log('error');
        }
    }


    let loginUser = async(e )=> {
        e.preventDefault()
        let response = await fetch('http://127.0.0.1:8000/api/token/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({'username': e.target.username.value, 'password': e.target.password.value}),
        })
        let data = await response.json()
        if(response.status===200){
            setUser(jwt_decode(data.access))
            localStorage.setItem('authToken', JSON.stringify(data))
            window.location.href = '/'
        } else {
            console.log('error')
        } 
    }
    
    let logoutUser = () => {
        setUser(null)
        localStorage.removeItem('authToken')
        window.location.href = '/'
    }



    let contextData = {
        user:user,
        loginUser:loginUser,
        logoutUser:logoutUser,
        userlist:userlist,
        getUserList:getUserList,
    }

    return (
        <AuthContext.Provider value={contextData}>
            { children }
        </AuthContext.Provider>
    )
}
