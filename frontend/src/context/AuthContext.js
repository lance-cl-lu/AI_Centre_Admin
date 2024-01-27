import { createContext, useState } from "react";
import jwt_decode from "jwt-decode";


const AuthContext = createContext();

export default AuthContext;

export const AuthProvider = ({ children }) => {

    const [user, setUser] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken')) : null)

    const [userlist, setUesrlist] = useState(null)

    let getUserList = async ( ) => {
        let response = await fetch('/api/ldap/info/', {
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
        let response = await fetch('/api/token/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({'username': e.target.username.value, 'password': e.target.password.value}),
        })
        let data = await response.json()
        if(response.status===200){
            // check data.access is not null
            if(data.access) {
                setUser(jwt_decode(data.access))
            } else {
                alert('Username or password is incorrect')
                return
            }
            if(data) {
                localStorage.setItem('authToken', JSON.stringify(data))
            } else {
                localStorage.removeItem('authToken')
                return
            }
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
