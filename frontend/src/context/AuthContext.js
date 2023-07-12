import { createContext, useState, useEffect } from "react";
import jwt_decode from "jwt-decode";
import { redirect } from "react-router-dom";

const AuthContext = createContext();

export default AuthContext;

export const AuthProvider = ({ children }) => {

    const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken') ? JSON.parse(localStorage.getItem('authToken')) : null)
    const [user, setUser] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken')) : null)

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
            setAuthToken(data)
            setUser(jwt_decode(data.access))
            localStorage.setItem('authToken', JSON.stringify(data))
            redirect = '/'
        } else {
            console.log('error')
        } 
    }
    
    let logoutUser = () => {
        setAuthToken(null)
        setUser(null)
        localStorage.removeItem('authToken')
        redirect = '/'
    }

    let contextData = {
        user:user,
        loginUser:loginUser,
        logoutUser:logoutUser,
    }

    return (
        <AuthContext.Provider value={contextData}>
            { children }
        </AuthContext.Provider>
    )
}
