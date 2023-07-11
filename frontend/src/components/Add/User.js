function AddUser() {
    return (
        <div>
            <h1>Add User</h1>
            <form>
                <label>First Name:   </label><input type="text" placeholder="Please enter the first name" /><br/>
                <label>Last Name:   </label><input type="text" placeholder="Please enter the last name" /><br/>
                <label>Username:   </label><input type="text" placeholder="Please enter the username" /><br/>
                <label>Email:   </label><input type="text" placeholder="Please enter the email" /><br/>
                <label>In which labatory:   </label><select>
                    <option value="lab1">Lab 1</option>
                    <option value="lab2">Lab 2</option>
                    <option value="lab3">Lab 3</option>
                    <option value="lab4">Lab 4</option>
                </select><br/>
                <label>Is Lab Manager:   <input type="checkbox"/></label><br/>
                <label>Password:   </label><input type="text" placeholder="Please enter the password" /><br/>
                <label>Confirm Password:   </label><input type="text" placeholder="Please enter the password again" /><br/>
                <button>Submit</button>
            </form>
        </div>
    )
}
export default AddUser