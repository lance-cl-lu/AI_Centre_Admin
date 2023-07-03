import { Link } from 'react-router-dom';
import './Infolist.css';
function Infolist() {
    return ( 
        <div className="infolist">
            <ul>
                <li><Link to ="/">Dashboard</Link></li>
                <ul>
                    <li><span>Lab1</span></li>
                        <ul>
                            <li><span>User1</span></li>
                            <li><span>User2</span></li>
                            <li><span>User3</span></li>
                        </ul>
                    <li><span>Lab2</span></li>
                        <ul>
                            <li><span>User1</span></li>
                            <li><span>User2</span></li>
                            <li><span>User3</span></li>
                        </ul>
                    <li><span>Lab3</span></li>
                    <li><span>Lab4</span></li>
                    <li><span>Lab5</span></li>
                </ul>
            </ul>
        </div>
    );
}

export default Infolist;