import { Link } from "react-router-dom"
import "./Add.css"

function Add() {
    
    return (
        <div className="AddContent">
            <div className="AddType"><Link to="/add/lab"><span>Add Labatory</span></Link></div>
            <div className="AddType"><Link to="/add/user"><span>Add User</span></Link></div>
            <div className="AddType"><Link to="/add/admin"><span>Add Administrator</span></Link></div>
            <div className="AddType"><Link to="/add/excel"><span>Import from Excel</span></Link></div>
        </div>
    )
}
export default Add