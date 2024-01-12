import { Route, Navigate } from "react-router-dom";
import { useContext}  from "react";
import AuthContext from "./AuthContext";

const PrivateRoute = ({ childern, ...rest }) => {
    let {user} = useContext(AuthContext);
    return (
        <Route  {...rest}>{!user ? <Navigate to="/login" /> : childern} </Route>
    )
}

export default PrivateRoute;