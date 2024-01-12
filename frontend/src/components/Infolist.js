import './Infolist.css';
import { AuthProvider } from '../context/AuthContext';
import TreeView from './List/Tree';
import { motion } from "framer-motion";
import { useState } from "react"
import jwt_decode from "jwt-decode"
function Infolist() {  
    const [ permission ] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken'))['permission'] : null)
    let matchedResult = /.*admin$/.test(permission);
    console.log(matchedResult)
    return ( 
            matchedResult || permission==='root' ? (
            <motion.div
            className="infolist"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
                duration: 0.8,
                ease: [1, 0.5, 0.2, 1],
            }}
            >
                <AuthProvider>
                    <TreeView/>
                </AuthProvider>
            </motion.div>
            ) : (
            <div className="infolist">
            </div>
            )
    );
}

export default Infolist;

