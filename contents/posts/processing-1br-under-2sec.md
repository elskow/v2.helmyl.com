---
title: 'How can I process 1 billion records under 2 seconds?'
date: 2024-09-06
image: '/images/1brc-under-2sec/1brc-logo.png'
---

Processing large datasets is a common challenge in data engineering and data science. When dealing with massive volumes
of data, optimizing processing time becomes critical to avoid performance bottlenecks.

<img src="../../static/images/1brc-under-2sec/1brc-logo.png" alt="1 Billion Row Challenge Logo" width="200" style="display: block; margin: 0 auto;">

Recently, on the internet I found a fascinating challenge: ["One Billion Row Challenge"](https://1brc.dev/). This
challenge went viral, especially on Twitter (now X). The task is straightforward: process 1 billion temperature records
for cities around the world, and return the minimum, maximum, and average temperatures for each city.

The challenge is language-specific, each language had its own leaderboard. The actual challenge was needed to use Java.
The fastest solution were able to process the 1 billion records in 1.535 seconds, using GraalVM and uses unsafe
operations. I was curious to see how fast I could process the 1 billion records using C++.

## My approach and solution

My approach was inspired by someone (I forgot who) building their own database system. They mentioned that systems have a mmap() function, which allows mapping a file into memory. This way, the file is loaded into memory and can be accessed as if it were an array. This is a very efficient way to read large files, as the operating system can manage the memory mapping and caching.

I decided to use this approach to read the input file, which contains the 1 billion records. I then used a hash map to
store the minimum, maximum, and sum of the temperatures for each city. Finally, I iterated over the hash map to
calculate the average temperature for each city.

### The key step of my solution :

1. **Memory Mapping the Input File** <br/>
   To efficiently load the 1 billion records, I used the mmap() system call, which maps the file into memory and treats
   it as an array. This approach minimizes the I/O overhead by leveraging the OS’s memory management capabilities.
    ```cpp
   char* file_data = static_cast<char*>(mmap(nullptr, sb.st_size, PROT_READ, MAP_PRIVATE, fd, 0));
   ```
   This approach lets the OS handle memory paging and caching, providing faster file access compared to standard file
   I/O.

2. **Custom Float Parsing** <br/>
   To parse the temperature values from the input file, I implemented a custom float parser that converts the string
   representation of a float to a double. This parser is optimized for performance and can handle both positive and
   negative numbers.
     ```cpp
    double parse_float(const char* str) {
      float result = 0.0f;
      bool negative = false;
      size_t i = 0;

      // Skip leading whitespaces
      if (str[i] == '-') {
         negative = true;
        i++;
      }

      // Parse the integer part
      while (i < len && str[i] != '.') {
          result = result * 10.0f + static_cast<float>(str[i] - '0');
          i++;
      }

      // Parse the fraction part
      if (i < len && str[i] == '.') {
          i++;
          float fraction = 1.0f;
          while (i < len) {
              fraction *= 0.1f;
              result += static_cast<float>(str[i] - '0') * fraction;
              i++;
          }
      }

      return negative ? -result : result;
    }
    ```
   This custom parser is more efficient than standard library functions like std::stod() and std::atof(), which can be
   slow for large datasets.

3. **Multithreading Implementation** <br/>
   The dataset is divided into chunks, each of which is processed by a separate thread. This allows the program to
   utilize the full power of the CPU by distributing the workload across all cores.
   ```cpp
   size_t num_threads = std::thread::hardware_concurrency();
   size_t chunk_size = sb.st_size / num_threads;
   ```
    ```mermaid
     graph TD;
     A1[File Mapped to Memory] --> B1[Chunk 1]
     A1 --> C1[Chunk 2]
     A1 --> D1[Chunk N]
     B1 --> T1[Thread 1: Process Chunk]
     C1 --> T2[Thread 2: Process Chunk]
     D1 --> TN[Thread N: Process Chunk]
   ```

4. **Lock-Free Procesing with Local Aggregation** <br/>
   To avoid contention and synchronization overhead, each thread maintains a local hash map to store the temperature
   data
   for the cities it processes. This lock-free approach allows each thread to process its chunk independently and
   efficiently.
    ```cpp
   std::unordered_map<std::string, locationData> local_loc_data;
   process_chunk(file_data, start_pos, end, local_loc_data);
   ```
   The local hash maps are updated independently by each thread, reducing contention and improving performance.
     ```mermaid
          graph TD;
          T1[Thread 1: Process Chunk] --> L1[Local Hash Map 1]
          T2[Thread 2: Process Chunk] --> L2[Local Hash Map 2]
          TN[Thread N: Process Chunk] --> LN[Local Hash Map N]
    ```

5. **Thread-Safe Global Aggregation** <br/>
   After each thread finishes processing, the local hash maps are merged into a global hash map. This merging process is
   synchronized using a mutex to ensure thread safety.
    ```cpp
   std::unordered_map<std::string, locationData> local_loc_data;
   // Update global data
   std::lock_guard<std::mutex> lock(loc_data_mutex);
   for (const auto& [key, value] : local_loc_data) {
    // Merge data
   }
   ```
   Finally, the minimum, maximum, and average temperatures for each city are computed based on the aggregated data.
    ```mermaid
        graph TD;
        T1[Local Hash Map 1] --> G1[Global Hash Map]
        T2[Local Hash Map 2] --> G1
        TN[Local Hash Map N] --> G1
        G1 --> H1[Final Aggregation]
   ```

6. **Avoiding String Copying** <br/>
   To avoid unnecessary string copying and memory allocation, I used std::string_view to represent the city names in the
   hash map. This lightweight wrapper provides a non-owning view of the underlying string data, reducing memory usage
   and
   improving performance.
     ```cpp
    std::string location = std::string(line.substr(0, delimiter_pos)); // Extract the location
    ```

## Results

After implementing my solution in C++, I ran the program on a machine with 8 Cores and 24 GB of RAM. The program
processed the 1 billion records in **1.35808** seconds. This result was comparable to the fastest Java solution, which
processed the data in **1.535** seconds.

> **Note**: While mmap() can offer significant performance improvements, its behavior is unpredictable and can vary
> depending on the operating system, hardware, and file system.


<blockquote class="twitter-tweet" data-align="center">
 <p lang="und" dir="ltr">1brc; &lt; 2 sec
   <a href="https://twitter.com/hashtag/PamerAjaDulu?src=hash&amp;ref_src=twsrc%5Etfw">#PamerAjaDulu</a> 
   <a href="https://t.co/nuQdnoZoZ3">pic.twitter.com/nuQdnoZoZ3</a>
 </p>&mdash; el (@helmy_lh) 
 <a href="https://twitter.com/helmy_lh/status/1825151101471273339?ref_src=twsrc%5Etfw">August 18, 2024</a>
</blockquote> 
<script src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

Complete code is available on my [GitHub repository](https://github.com/elskow/1brc-cpp-under-2s).