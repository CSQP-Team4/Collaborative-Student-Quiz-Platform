// Seed question bank (CSQP-5): 55 questions across 5 subjects, 18 topics,
// 3 difficulty levels and all 3 question types.
//
// - MCQ / TRUE_FALSE: `answer` is the exact text of the correct option.
// - SUBJECTIVE (short answer): `answer` is a model answer for manual grading.
// - status defaults to 'approved' (added by the instructor). Questions marked
//   'pending' or 'rejected' are student contributions for testing the
//   approval queue (CSQP-F-020, CSQP-F-023).

const TF = ['True', 'False'];

const DS = 'Data Structures';
const DBMS = 'Database Management Systems';
const OS = 'Operating Systems';
const CN = 'Computer Networks';
const SE = 'Software Engineering';

const SEED_QUESTIONS = [
  // ---------------- Data Structures ----------------
  {
    subject: DS, topic: 'Linked Lists', difficulty: 'easy', type: 'MCQ',
    text: 'What is the time complexity of inserting a node at the head of a singly linked list?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    answer: 'O(1)',
  },
  {
    subject: DS, topic: 'Linked Lists', difficulty: 'easy', type: 'TRUE_FALSE',
    text: 'In a doubly linked list, each node stores pointers to both its next and previous nodes.',
    options: TF, answer: 'True',
  },
  {
    subject: DS, topic: 'Linked Lists', difficulty: 'medium', type: 'MCQ',
    text: 'Which technique detects a cycle in a linked list using O(1) extra space?',
    options: ["Floyd's tortoise and hare", 'Breadth-first search', 'Binary search', 'Hashing every visited node'],
    answer: "Floyd's tortoise and hare",
  },
  {
    subject: DS, topic: 'Trees', difficulty: 'easy', type: 'MCQ',
    text: 'Which traversal of a binary search tree visits the keys in ascending order?',
    options: ['Inorder', 'Preorder', 'Postorder', 'Level order'],
    answer: 'Inorder',
  },
  {
    subject: DS, topic: 'Trees', difficulty: 'medium', type: 'TRUE_FALSE',
    text: 'The height of an AVL tree with n nodes is O(log n).',
    options: TF, answer: 'True',
  },
  {
    subject: DS, topic: 'Trees', difficulty: 'hard', type: 'MCQ',
    text: 'What is the maximum number of nodes in a binary tree of height h, where a single-node tree has height 0?',
    options: ['2^(h+1) - 1', '2^h', '2^h - 1', 'h^2'],
    answer: '2^(h+1) - 1',
  },
  {
    subject: DS, topic: 'Trees', difficulty: 'medium', type: 'SUBJECTIVE', status: 'pending',
    text: 'Explain why a binary search tree can degrade to O(n) search time, and name one way to prevent it.',
    answer: 'If keys are inserted in sorted order the tree becomes a chain of height n, so search takes O(n). Self-balancing trees such as AVL or red-black trees keep the height O(log n).',
  },
  {
    subject: DS, topic: 'Graphs', difficulty: 'medium', type: 'MCQ',
    text: 'Which algorithm finds the shortest paths from one source vertex in a graph with non-negative edge weights?',
    options: ["Dijkstra's algorithm", "Kruskal's algorithm", 'Depth-first search', 'Topological sort'],
    answer: "Dijkstra's algorithm",
  },
  {
    subject: DS, topic: 'Graphs', difficulty: 'easy', type: 'TRUE_FALSE',
    text: 'Breadth-first search uses a queue to decide which vertex to visit next.',
    options: TF, answer: 'True',
  },
  {
    subject: DS, topic: 'Sorting and Searching', difficulty: 'easy', type: 'MCQ',
    text: 'What is the worst-case time complexity of binary search on a sorted array of n elements?',
    options: ['O(log n)', 'O(1)', 'O(n)', 'O(n log n)'],
    answer: 'O(log n)',
  },
  {
    subject: DS, topic: 'Sorting and Searching', difficulty: 'hard', type: 'MCQ',
    text: 'Which of these sorting algorithms is stable in its standard form?',
    options: ['Merge sort', 'Quick sort', 'Heap sort', 'Selection sort'],
    answer: 'Merge sort',
  },

  // ---------------- Database Management Systems ----------------
  {
    subject: DBMS, topic: 'SQL', difficulty: 'easy', type: 'MCQ',
    text: 'Which SQL clause filters groups after aggregation?',
    options: ['HAVING', 'WHERE', 'ORDER BY', 'GROUP BY'],
    answer: 'HAVING',
  },
  {
    subject: DBMS, topic: 'SQL', difficulty: 'medium', type: 'MCQ',
    text: 'Which join returns all rows from the left table and the matching rows from the right table?',
    options: ['LEFT OUTER JOIN', 'INNER JOIN', 'CROSS JOIN', 'RIGHT OUTER JOIN'],
    answer: 'LEFT OUTER JOIN',
  },
  {
    subject: DBMS, topic: 'SQL', difficulty: 'easy', type: 'TRUE_FALSE',
    text: 'A PRIMARY KEY column can contain NULL values.',
    options: TF, answer: 'False',
  },
  {
    subject: DBMS, topic: 'SQL', difficulty: 'medium', type: 'SUBJECTIVE', status: 'pending',
    text: 'Write an SQL query that returns the number of students in each department from the table Students(id, name, dept).',
    answer: 'SELECT dept, COUNT(*) AS num_students FROM Students GROUP BY dept;',
  },
  {
    subject: DBMS, topic: 'Normalization', difficulty: 'medium', type: 'MCQ',
    text: 'A relation is in 2NF if it is in 1NF and has no ___.',
    options: [
      'partial dependency of a non-prime attribute on a candidate key',
      'transitive dependency',
      'multivalued dependency',
      'join dependency',
    ],
    answer: 'partial dependency of a non-prime attribute on a candidate key',
  },
  {
    subject: DBMS, topic: 'Normalization', difficulty: 'medium', type: 'TRUE_FALSE',
    text: 'Every relation in BCNF is also in 3NF.',
    options: TF, answer: 'True',
  },
  {
    subject: DBMS, topic: 'Normalization', difficulty: 'hard', type: 'MCQ',
    text: 'Which normal form removes transitive dependencies of non-prime attributes on candidate keys?',
    options: ['3NF', '1NF', '2NF', '4NF'],
    answer: '3NF',
  },
  {
    subject: DBMS, topic: 'Transactions', difficulty: 'easy', type: 'MCQ',
    text: "What does the 'A' in ACID stand for?",
    options: ['Atomicity', 'Availability', 'Accuracy', 'Authorization'],
    answer: 'Atomicity',
  },
  {
    subject: DBMS, topic: 'Transactions', difficulty: 'medium', type: 'TRUE_FALSE',
    text: 'Two-phase locking (2PL) guarantees conflict-serializable schedules.',
    options: TF, answer: 'True',
  },
  {
    subject: DBMS, topic: 'Transactions', difficulty: 'hard', type: 'MCQ',
    text: 'Which problem occurs when a transaction reads data written by another transaction that has not yet committed?',
    options: ['Dirty read', 'Phantom read', 'Lost update', 'Deadlock'],
    answer: 'Dirty read',
  },
  {
    subject: DBMS, topic: 'Transactions', difficulty: 'hard', type: 'SUBJECTIVE',
    text: 'Explain the difference between deadlock and starvation in concurrency control.',
    answer: "Deadlock: two or more transactions wait for each other's locks forever, so none of them can proceed. Starvation: one transaction waits indefinitely because others are repeatedly favoured, even though the system as a whole keeps making progress.",
  },

  // ---------------- Operating Systems ----------------
  {
    subject: OS, topic: 'CPU Scheduling', difficulty: 'easy', type: 'MCQ',
    text: 'Which CPU scheduling algorithm can cause starvation of long processes?',
    options: ['Shortest Job First', 'Round Robin', 'First Come First Served', 'None of these'],
    answer: 'Shortest Job First',
  },
  {
    subject: OS, topic: 'CPU Scheduling', difficulty: 'easy', type: 'TRUE_FALSE',
    text: 'Round Robin scheduling gives each process a fixed time quantum.',
    options: TF, answer: 'True',
  },
  {
    subject: OS, topic: 'Processes and Threads', difficulty: 'medium', type: 'MCQ',
    text: 'What does the fork() system call return in the child process?',
    options: ['0', "The child's PID", "The parent's PID", '-1'],
    answer: '0',
  },
  {
    subject: OS, topic: 'Processes and Threads', difficulty: 'medium', type: 'SUBJECTIVE', status: 'pending',
    text: 'Differentiate between a process and a thread.',
    answer: "A process is an independent program in execution with its own address space and resources. A thread is a unit of execution inside a process: threads share the process's code, data and open files, but each has its own stack and registers.",
  },
  {
    subject: OS, topic: 'Memory Management', difficulty: 'medium', type: 'MCQ',
    text: "Which page replacement algorithm can suffer from Belady's anomaly?",
    options: ['FIFO', 'LRU', 'Optimal (OPT)', 'None of these'],
    answer: 'FIFO',
  },
  {
    subject: OS, topic: 'Memory Management', difficulty: 'medium', type: 'TRUE_FALSE',
    text: 'Paging eliminates external fragmentation.',
    options: TF, answer: 'True',
  },
  {
    subject: OS, topic: 'Memory Management', difficulty: 'hard', type: 'MCQ',
    text: 'A system uses 32-bit logical addresses and 4 KB pages. How many bits are used for the page offset?',
    options: ['12', '10', '20', '32'],
    answer: '12',
  },
  {
    subject: OS, topic: 'Memory Management', difficulty: 'hard', type: 'SUBJECTIVE',
    text: 'What is thrashing, and how does the working-set model reduce it?',
    answer: 'Thrashing is when processes spend more time paging than executing because they lack enough frames for their working sets. The working-set model gives each process enough frames for its recently used pages and suspends processes when total demand exceeds available memory.',
  },
  {
    subject: OS, topic: 'Synchronization', difficulty: 'medium', type: 'MCQ',
    text: 'Which of these is NOT one of the four necessary conditions for deadlock?',
    options: ['Preemption', 'Mutual exclusion', 'Hold and wait', 'Circular wait'],
    answer: 'Preemption',
  },
  {
    subject: OS, topic: 'Synchronization', difficulty: 'easy', type: 'TRUE_FALSE',
    text: 'A binary semaphore can be used to implement mutual exclusion.',
    options: TF, answer: 'True',
  },
  {
    subject: OS, topic: 'Synchronization', difficulty: 'hard', type: 'MCQ',
    text: "For how many processes does Peterson's solution guarantee mutual exclusion?",
    options: ['Two', 'Any number', 'Three', 'One'],
    answer: 'Two',
  },

  // ---------------- Computer Networks ----------------
  {
    subject: CN, topic: 'Network Models', difficulty: 'easy', type: 'MCQ',
    text: 'At which OSI layer does a router primarily operate?',
    options: ['Network layer', 'Data link layer', 'Transport layer', 'Physical layer'],
    answer: 'Network layer',
  },
  {
    subject: CN, topic: 'Network Models', difficulty: 'easy', type: 'TRUE_FALSE', status: 'rejected',
    text: 'HTTP is an application-layer protocol.',
    options: TF, answer: 'True',
  },
  {
    subject: CN, topic: 'Network Models', difficulty: 'medium', type: 'SUBJECTIVE', status: 'pending',
    text: 'Name the four layers of the TCP/IP model and give one protocol used at each.',
    answer: 'Application (HTTP), Transport (TCP), Internet (IP), Link / Network Access (Ethernet).',
  },
  {
    subject: CN, topic: 'Transport Layer', difficulty: 'easy', type: 'MCQ',
    text: 'Which transport-layer protocol provides reliable, connection-oriented delivery?',
    options: ['TCP', 'UDP', 'IP', 'ICMP'],
    answer: 'TCP',
  },
  {
    subject: CN, topic: 'Transport Layer', difficulty: 'medium', type: 'MCQ',
    text: "How many segments are exchanged in TCP's connection-establishment handshake?",
    options: ['3', '2', '4', '1'],
    answer: '3',
  },
  {
    subject: CN, topic: 'Transport Layer', difficulty: 'medium', type: 'TRUE_FALSE',
    text: 'UDP guarantees that packets arrive in the order they were sent.',
    options: TF, answer: 'False',
  },
  {
    subject: CN, topic: 'Transport Layer', difficulty: 'hard', type: 'SUBJECTIVE',
    text: 'Explain how TCP congestion control uses slow start and congestion avoidance.',
    answer: 'In slow start the congestion window starts small and doubles every round-trip time until it reaches the slow-start threshold. Congestion avoidance then grows it linearly, by about one segment per RTT. On packet loss the threshold is halved and the window is reduced.',
  },
  {
    subject: CN, topic: 'Network Layer', difficulty: 'medium', type: 'MCQ',
    text: 'How many usable host addresses does a /24 IPv4 subnet have?',
    options: ['254', '256', '255', '252'],
    answer: '254',
  },
  {
    subject: CN, topic: 'Network Layer', difficulty: 'medium', type: 'MCQ',
    text: 'Which protocol maps an IPv4 address to a MAC address on a local network?',
    options: ['ARP', 'DNS', 'DHCP', 'ICMP'],
    answer: 'ARP',
  },
  {
    subject: CN, topic: 'Network Layer', difficulty: 'easy', type: 'TRUE_FALSE',
    text: 'IPv6 addresses are 128 bits long.',
    options: TF, answer: 'True',
  },
  {
    subject: CN, topic: 'Network Layer', difficulty: 'hard', type: 'MCQ',
    text: 'What is the subnet mask of a /26 IPv4 network?',
    options: ['255.255.255.192', '255.255.255.224', '255.255.255.128', '255.255.255.240'],
    answer: '255.255.255.192',
  },

  // ---------------- Software Engineering ----------------
  {
    subject: SE, topic: 'Agile and Scrum', difficulty: 'easy', type: 'MCQ',
    text: 'In Scrum, what is the fixed-length period in which a planned set of work is completed?',
    options: ['Sprint', 'Epic', 'Backlog', 'Release'],
    answer: 'Sprint',
  },
  {
    subject: SE, topic: 'Agile and Scrum', difficulty: 'easy', type: 'TRUE_FALSE',
    text: 'Story points estimate the relative effort of a backlog item rather than hours.',
    options: TF, answer: 'True',
  },
  {
    subject: SE, topic: 'Agile and Scrum', difficulty: 'medium', type: 'SUBJECTIVE', status: 'pending',
    text: 'What is the purpose of a sprint retrospective?',
    answer: "The team reviews how the sprint went (what worked and what didn't) and agrees on concrete improvements to its process for the next sprint.",
  },
  {
    subject: SE, topic: 'SDLC Models', difficulty: 'medium', type: 'MCQ',
    text: 'Which SDLC model suits a project whose requirements are well understood and unlikely to change?',
    options: ['Waterfall', 'Spiral', 'Prototyping', 'Scrum'],
    answer: 'Waterfall',
  },
  {
    subject: SE, topic: 'Software Testing', difficulty: 'easy', type: 'MCQ',
    text: 'Which testing level checks individual functions or modules in isolation?',
    options: ['Unit testing', 'Integration testing', 'System testing', 'Acceptance testing'],
    answer: 'Unit testing',
  },
  {
    subject: SE, topic: 'Software Testing', difficulty: 'medium', type: 'MCQ',
    text: 'Which testing technique designs test cases from the internal structure of the code?',
    options: ['White-box testing', 'Black-box testing', 'Acceptance testing', 'Usability testing'],
    answer: 'White-box testing',
  },
  {
    subject: SE, topic: 'Software Testing', difficulty: 'medium', type: 'TRUE_FALSE',
    text: 'Regression testing re-runs existing tests to check that recent changes have not broken working features.',
    options: TF, answer: 'True',
  },
  {
    subject: SE, topic: 'Software Testing', difficulty: 'hard', type: 'MCQ',
    text: 'A function accepts integers from 1 to 100 inclusive. Using boundary value analysis, which set of inputs is most appropriate?',
    options: ['0, 1, 100, 101', '1, 50, 100', '-1, 0, 1', '25, 50, 75'],
    answer: '0, 1, 100, 101',
  },
  {
    subject: SE, topic: 'Requirements Engineering', difficulty: 'easy', type: 'MCQ',
    text: 'Which of these is a non-functional requirement?',
    options: [
      'Pages must load within 2 seconds',
      'Students can upload a PDF',
      'Instructors can approve questions',
      'Students can take a quiz',
    ],
    answer: 'Pages must load within 2 seconds',
  },
  {
    subject: SE, topic: 'Requirements Engineering', difficulty: 'medium', type: 'TRUE_FALSE',
    text: 'A requirements traceability matrix links each requirement to its design elements and test cases.',
    options: TF, answer: 'True',
  },
  {
    subject: SE, topic: 'Requirements Engineering', difficulty: 'hard', type: 'SUBJECTIVE',
    text: 'Explain the difference between verification and validation.',
    answer: "Verification checks that the product is built correctly against its specification (are we building the product right?). Validation checks that it meets the users' actual needs (are we building the right product?).",
  },
];

module.exports = { SEED_QUESTIONS };
