CourierTrack Pro: MERN Stack Parcel Management SystemThis project is a comprehensive Courier Tracking and Parcel Management System built using the MERN stack (MongoDB, Express, React, Node.js) with real-time 
updates via Socket.IO. It is designed to facilitate parcel booking for customers, status updates for agents, and monitoring/reporting for administrators.📝 Table of ContentsFeaturesTechnology StackProject StructureSetup 
and InstallationDeployment LinksDemo Credentials1. FeaturesThe system implements a robust Role-Based Access Control (RBAC) model with three primary roles: Admin, Delivery Agent, 
and Customer.RoleKey FeaturesCustomer* Booking: Book new parcel pickups with details (addresses, size/type, COD/Prepaid). * Tracking: Track parcels in real-time (live status and map location).
* History: View all past and current booking history.Delivery Agent* Assignments: View a list of all assigned parcels and customer details. * Status Update: Update parcel status (Picked Up, In Transit, Delivered, Failed) with corresponding location logging.
* Live Tracking: Sends real-time GPS coordinates of the current location to the tracking system.Admin* Dashboard: View daily metrics (bookings, COD collection, deliveries) and 7-day booking trends.
* * Management: View/manage all users and parcels. * Assignment: Assign parcels to available delivery agents, triggering email notifications. * Reporting: Export detailed booking reports (CSV) and view COD collection summaries per agent.2.
  
* Technology StackLayerTechnologiesKey ModulesBackendNode.js, Express, MongoDB (Native)jsonwebtoken, bcryptjs, socket.io, nodemailer, cors, helmetFrontendReact.js,
  Tailwind CSSreact-router-dom, axios (with Interceptors for refresh token), socket.io-client, lucide-reactDatabaseMongoDB Atlas (NoSQL)MongoDB Native Driver for efficient querying and indexing.AdvancedReal-time Communication,
*   Email Notifications, QR Code Generation3. Project StructureThe project is structured into standard frontend and backend directories for clear separation of concerns.
courier-tracking-project/
├── courier-backend/
│   ├── index.js          # Main server file (Routes, DB, Middleware, Socket.IO)
│   └── .env              # Environment variables
│
└── courier-tracking-frontend/
    ├── src/
    │   ├── components/   # UI components grouped by function (Admin, Customer, Layout)
    │   ├── context/      # AuthContext
    │   ├── hooks/        # useAuth, useSocket
    │   ├── services/     # api.js (Axios), socket.js (Socket client)
    │   └── utils/        # helpers.js (utility functions)
    └── package.json
4. Setup and InstallationFollow these steps to set up the project locally.4.1. Backend SetupClone the repository:Bashgit clone <your-repo-link>
cd courier-backend
Install dependencies:Bashnpm install
Configure environment variables:Create a file named .env in the courier-backend directory and add the following configuration:Code snippetPORT=5000

# MongoDB Atlas Connection
DB_USER=your_mongo_user
DB_PASS=your_mongo_pass
# Get your MONGO_URI from Atlas (Replace cluster0 with your cluster name)
MONGO_URI="mongodb+srv://${DB_USER}:${DB_PASS}@cluster0.cjuyyb2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0" 

# JWT Secrets (Change these for production)
JWT_SECRET=your_jwt_secret_change_in_production
JWT_REFRESH_SECRET=your_refresh_secret_change_in_production

# Email Configuration (for Nodemailer/Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=naymurrahmanriyad4@gmail.com
SMTP_PASS=your_16_digit_app_password 

# Frontend URL (for CORS and Email Links)
CLIENT_URL=http://localhost:5173
Note on SMTP: Use a Google App Password for SMTP_PASS, not your regular email password. Ensure 2FA is enabled on your Google account.Start the server:Bashnpm start  # Runs 'node index.js' or configured start script
4.2. Frontend SetupNavigate to the frontend directory:Bashcd ../courier-tracking-frontend
Install dependencies:Bashnpm install
Configure environment variables:Create a file named .env or .env.local (depending on your React setup) and add the API URLs:Code snippet# Points to your running backend server (must match port)
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
Start the client:Bashnpm run dev  # Or npm start
5. Deployment LinksEnvironmentEndpointLinkFrontend (Client)Web Applicationhttps://curier-client.vercel.appBackend (Server)API Base URLhttps://curier-server.onrender.comBackend Health CheckVerificationhttps://curier-server.onrender.com/health6. Demo CredentialsYou can use these accounts to test the application's RBAC and features:RoleEmailPasswordAdminadmin@example.comadmin123Agentagent@example.comagent123Customercustomer@example.comcustomer123Project maintained by: [Your Name/Company]
