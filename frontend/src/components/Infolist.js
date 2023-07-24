import './Infolist.css';
import { AuthProvider } from '../context/AuthContext';
import TreeView from './List/Tree';

function Infolist() {    
    return ( 
        <div className="infolist">
            <AuthProvider>
                <TreeView/>
            </AuthProvider>
        </div>
    );
}

export default Infolist;

