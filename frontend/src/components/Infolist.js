import './Infolist.css';
import { AuthProvider } from '../context/AuthContext';
import TreeView from './List/Tree';
import { motion } from "framer-motion";
function Infolist() {    
    return ( 
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
    );
}

export default Infolist;

