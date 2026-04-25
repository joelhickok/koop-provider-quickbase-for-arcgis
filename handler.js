export default function handleRequest(req, res) {
    res.status(200).send(`
        <style>
            div {
                margin-bottom: 10px;
            }
            
            .card {
                background: ghostwhite; 
                padding: 20px;
                border-radius: 10px;  
            }
        </style>
        <div style="width: 500px; font-family: 'Fira Code Light', Arial, Helvetica, sans-serif;">
            <h3>Welcome to Koop!</h3>
            <div class="card">
                This is an instance of Koop used for demos.<br><br>
           
                You must have the correct URL of a output service.
            </div>
        </div>
    `)
}