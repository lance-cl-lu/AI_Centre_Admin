import "../style.css"
import { Link } from "react-router-dom";
function Navbar() {
  return (
    <nav className="navigation">
        <ul>
          <li><img src="https://aic.cgu.edu.tw/var/file/44/1044/msys_1044_4886051_59674.png" alt="CUG AI Centre"/></li>
          <div>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/add">Add</Link></li>
            <li><button><img src="https://global.discourse-cdn.com/business6/uploads/glitch/optimized/2X/c/ca4dff4f8a1797712edf717970e4193e09ba0f9c_2_500x500.gif" alt="userProfile"/></button></li>
          </div>
      </ul>
    </nav>
  );
}
export default Navbar;